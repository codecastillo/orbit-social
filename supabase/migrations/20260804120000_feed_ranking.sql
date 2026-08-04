-- Stage 2 of the ranking system: real retrieval and ranking, server-side.
--
-- Until now For You fetched the newest 20 posts globally and re-sorted those
-- 20 on the client, so it was not a recommender: nothing outside that window
-- could ever surface, and personalization was impossible by construction. The
-- formula also lived in two hand-copied places that had already drifted.
--
-- Everything here is SECURITY INVOKER on purpose. The posts SELECT policy
-- already enforces blocks, private accounts, and deactivation; running as the
-- caller keeps all of that working for free instead of reimplementing it.
--
-- Nothing calls these functions yet. They ship dark.

-- Tuning lives in data, so a weight change is an UPDATE and so is the kill
-- switch. One row, enforced.
CREATE TABLE IF NOT EXISTS public.feed_ranking_config (
  id                 BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled            BOOLEAN NOT NULL DEFAULT FALSE,
  -- Percentage rollout, hashed on user id so a viewer's bucket is stable.
  enabled_pct        SMALLINT NOT NULL DEFAULT 0 CHECK (enabled_pct BETWEEN 0 AND 100),
  -- Explicit allowlist for dogfooding, checked before the percentage.
  enabled_for        UUID[] NOT NULL DEFAULT '{}',
  weights            JSONB NOT NULL DEFAULT '{
    "w_author_affinity": 0.30,
    "w_topic_affinity": 0.15,
    "w_value_rate": 0.22,
    "w_recency": 0.18,
    "w_exploration": 0.10,
    "w_media": 0.05,
    "seen_penalty": -0.6,
    "confidence_target": 20,
    "shrink_k": 50,
    "diversity_step": 0.25
  }'::jsonb,
  -- Interaction weights, the single source of truth. The ranker, the ladder,
  -- and affinity precomputation all read these so they cannot drift apart.
  value_weights      JSONB NOT NULL DEFAULT '{
    "share_dm": 15,
    "comment_author_replied": 12,
    "repost": 8,
    "comment": 6,
    "bookmark": 5,
    "completion": 4,
    "profile_visit": 3,
    "reaction": 2,
    "like": 1,
    "poll_vote": 1,
    "share_external": 1,
    "scroll_past": -1,
    "not_interested": -25
  }'::jsonb,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.feed_ranking_config (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.feed_ranking_config ENABLE ROW LEVEL SECURITY;

-- Clients need to know whether ranking is on for them; the row holds no
-- secrets, only tuning constants.
DROP POLICY IF EXISTS "Ranking config is readable" ON public.feed_ranking_config;
CREATE POLICY "Ranking config is readable"
  ON public.feed_ranking_config FOR SELECT USING (true);

-- Affinity tables are created here but stay EMPTY until stage 4 populates
-- them. The ranker reads them now and the confidence term below is written so
-- that empty affinity degrades to freshness rather than to a broken feed.
CREATE TABLE IF NOT EXISTS public.viewer_author_affinity (
  viewer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score      REAL NOT NULL CHECK (score >= 0 AND score <= 1),
  raw_value  NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_id, author_id)
);

CREATE TABLE IF NOT EXISTS public.viewer_topic_affinity (
  viewer_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hashtag_id UUID NOT NULL REFERENCES public.hashtags(id) ON DELETE CASCADE,
  score      REAL NOT NULL CHECK (score >= 0 AND score <= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_id, hashtag_id)
);

ALTER TABLE public.viewer_author_affinity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewer_topic_affinity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Viewers read own author affinity" ON public.viewer_author_affinity;
CREATE POLICY "Viewers read own author affinity"
  ON public.viewer_author_affinity FOR SELECT USING (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Viewers read own topic affinity" ON public.viewer_topic_affinity;
CREATE POLICY "Viewers read own topic affinity"
  ON public.viewer_topic_affinity FOR SELECT USING (auth.uid() = viewer_id);

-- Returns ranked post ids, not full rows. The clients already have a
-- POST_SELECT that assembles profiles, media, and sound joins; duplicating
-- that shape in SQL would be a second thing to keep in sync. They hydrate by
-- id and re-apply this order.
CREATE OR REPLACE FUNCTION public.feed_for_you(
  p_limit   INTEGER DEFAULT 20,
  p_exclude UUID[] DEFAULT '{}'
)
RETURNS TABLE (post_id UUID, score NUMERIC, source TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  w JSONB;
  v_conf NUMERIC;
  v_muted_pattern TEXT;
BEGIN
  SELECT weights INTO w FROM feed_ranking_config WHERE id;

  -- Confidence: how much this viewer has told us. Drives whether the score
  -- leans on affinity or falls back to freshness. This single expression is
  -- why there is no cold-start branch anywhere.
  SELECT LEAST(1.0, COUNT(*)::numeric / (w->>'confidence_target')::numeric)
    INTO v_conf
  FROM post_likes
  WHERE user_id = v_viewer AND created_at > now() - INTERVAL '30 days';

  v_conf := COALESCE(v_conf, 0);

  -- Muted words become a server-side filter here. They were client-only,
  -- which is half the reason a ranked page of 20 could render as 3 cards.
  SELECT string_agg('(^|\W)' || regexp_replace(word, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '(\W|$)', '|')
    INTO v_muted_pattern
  FROM muted_words WHERE user_id = v_viewer;

  RETURN QUERY
  WITH
  -- Everything the viewer has already been shown recently. Feed surfaces
  -- only: opening a post deliberately is not the feed showing it to you.
  seen AS (
    SELECT pi.post_id,
           SUM(pi.views) AS views,
           SUM(pi.dwell_ms) AS dwell_ms
    FROM post_impressions pi
    WHERE pi.viewer_id = v_viewer
      AND pi.shown_date > CURRENT_DATE - 7
      AND pi.surface IN ('foryou', 'following', 'clips')
    GROUP BY pi.post_id
  ),
  base AS (
    SELECT p.id, p.user_id, p.created_at, p.content, p.type,
           p.like_count, p.comment_count, p.repost_count, p.bookmark_count
    FROM posts p
    WHERE p.reply_to_id IS NULL
      AND p.community_id IS NULL
      AND p.is_hidden = FALSE
      AND p.type <> 'reel'
      AND p.created_at > now() - INTERVAL '7 days'
      AND NOT (p.id = ANY(p_exclude))
      AND p.user_id <> v_viewer
      -- Filters that used to run AFTER ranking on the client, which is why a
      -- page of 20 could render as 3 with no backfill. They run before the
      -- limit now.
      AND NOT EXISTS (SELECT 1 FROM mutes m WHERE m.user_id = v_viewer AND m.muted_id = p.user_id
                        AND (m.expires_at IS NULL OR m.expires_at > now()))
      AND NOT EXISTS (SELECT 1 FROM post_feedback pf WHERE pf.user_id = v_viewer AND pf.post_id = p.id)
      AND (v_muted_pattern IS NULL OR COALESCE(p.content, '') !~* v_muted_pattern)
      -- Hard seen-exclusion: shown three times, or genuinely read once.
      AND NOT EXISTS (SELECT 1 FROM seen s WHERE s.post_id = p.id
                        AND (s.views >= 3 OR s.dwell_ms > 3000))
  ),
  -- Candidate sources. Each is independently capped so no single source can
  -- flood the set, and each is a bounded index scan.
  s1_following AS (
    SELECT b.id, 'following'::text AS src FROM base b
    WHERE EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = v_viewer AND f.following_id = b.user_id)
      AND b.created_at > now() - INTERVAL '72 hours'
    ORDER BY b.created_at DESC LIMIT 150
  ),
  -- Second degree: posts the people you follow have engaged with. Empty until
  -- there is a graph, which is fine and costs nothing.
  s2_second_degree AS (
    SELECT b.id, 'second_degree'::text AS src FROM base b
    WHERE b.created_at > now() - INTERVAL '48 hours'
      AND EXISTS (
        SELECT 1 FROM post_likes pl
        JOIN follows f ON f.following_id = pl.user_id AND f.follower_id = v_viewer
        WHERE pl.post_id = b.id
      )
    ORDER BY b.created_at DESC LIMIT 60
  ),
  -- Finally consumes post_hashtags, which the extraction trigger has been
  -- populating since April and nothing has ever read.
  s3_topic AS (
    SELECT b.id, 'topic'::text AS src FROM base b
    WHERE b.created_at > now() - INTERVAL '48 hours'
      AND EXISTS (
        SELECT 1 FROM post_hashtags ph
        JOIN viewer_topic_affinity vta ON vta.hashtag_id = ph.hashtag_id AND vta.viewer_id = v_viewer
        WHERE ph.post_id = b.id
      )
    ORDER BY b.created_at DESC LIMIT 60
  ),
  s5_trending AS (
    SELECT b.id, 'trending'::text AS src FROM base b
    WHERE b.created_at > now() - INTERVAL '24 hours'
    ORDER BY (b.like_count + b.comment_count * 6 + b.repost_count * 8 + b.bookmark_count * 5) DESC,
             b.created_at DESC
    LIMIT 30
  ),
  -- Distribution for people nobody follows yet. This is the part that makes
  -- a first post reachable at all.
  s6_cold_start AS (
    SELECT b.id, 'cold_start'::text AS src FROM base b
    JOIN profiles pr ON pr.id = b.user_id
    WHERE b.created_at > now() - INTERVAL '6 hours'
      AND pr.follower_count < 100
    ORDER BY b.created_at DESC LIMIT 20
  ),
  candidates AS (
    SELECT DISTINCT ON (id) id, src FROM (
      SELECT * FROM s1_following
      UNION ALL SELECT * FROM s2_second_degree
      UNION ALL SELECT * FROM s3_topic
      UNION ALL SELECT * FROM s5_trending
      UNION ALL SELECT * FROM s6_cold_start
    ) u
  ),
  scored AS (
    SELECT
      b.id,
      c.src,
      b.user_id,
      (
        -- Affinity, scaled by how much we actually know about this viewer.
        (w->>'w_author_affinity')::numeric * COALESCE(vaa.score, 0) * v_conf
      + (w->>'w_topic_affinity')::numeric * COALESCE((
          SELECT MAX(vta.score) FROM post_hashtags ph
          JOIN viewer_topic_affinity vta ON vta.hashtag_id = ph.hashtag_id
          WHERE ph.post_id = b.id AND vta.viewer_id = v_viewer
        ), 0) * v_conf
        -- Value per impression, shrunk toward the mean so a post with one
        -- view and one like does not read as a hit.
      + (w->>'w_value_rate')::numeric * (
          (b.like_count + b.comment_count * 6 + b.repost_count * 8 + b.bookmark_count * 5)::numeric
          / (COALESCE(imp.impressions, 0) + (w->>'shrink_k')::numeric)
        )
        -- Recency, with a half-life that respects format: a clip stays useful
        -- far longer than a text post, and one constant buried video.
      + (w->>'w_recency')::numeric * POWER(0.5,
          EXTRACT(EPOCH FROM (now() - b.created_at)) / 3600.0
          / CASE WHEN b.type = 'video' THEN 24 WHEN b.type = 'image' THEN 12 ELSE 6 END)
      + (w->>'w_exploration')::numeric * CASE WHEN c.src = 'cold_start' THEN 1 ELSE 0 END
      + (w->>'w_media')::numeric * CASE WHEN EXISTS (
          SELECT 1 FROM post_media pm WHERE pm.post_id = b.id) THEN 1 ELSE 0 END
        -- Unused affinity weight falls back to freshness, so a brand new
        -- viewer gets a sensible chronological-ish feed from the same
        -- expression rather than a special case.
      + (0.45 * (1 - v_conf)) * POWER(0.5,
          EXTRACT(EPOCH FROM (now() - b.created_at)) / 3600.0 / 12)
        -- Shown once already and skipped past.
      + CASE WHEN s.post_id IS NOT NULL THEN (w->>'seen_penalty')::numeric ELSE 0 END
      ) AS raw_score
    FROM candidates c
    JOIN base b ON b.id = c.id
    LEFT JOIN viewer_author_affinity vaa ON vaa.viewer_id = v_viewer AND vaa.author_id = b.user_id
    LEFT JOIN seen s ON s.post_id = b.id
    LEFT JOIN LATERAL (
      SELECT SUM(pi.views)::numeric AS impressions
      FROM post_impressions pi WHERE pi.post_id = b.id
    ) imp ON TRUE
  ),
  -- Author diversity: each additional post by the same author is worth less,
  -- so one prolific account cannot own the feed.
  diversified AS (
    SELECT id, src, raw_score,
           raw_score * GREATEST(0.1,
             1 - (w->>'diversity_step')::numeric
                 * (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY raw_score DESC) - 1)
           ) AS final_score
    FROM scored
  )
  SELECT d.id, d.final_score, d.src
  FROM diversified d
  ORDER BY d.final_score DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.feed_for_you(INTEGER, UUID[]) TO authenticated;

-- Following stays strictly chronological and complete, per the public
-- promise. This exists only to fix a real bug: the client reads follows with
-- a 1000-row cap and an IN list, so follow number 1001 silently vanished from
-- the tab with no signal to the user. A join has no such ceiling.
CREATE OR REPLACE FUNCTION public.following_feed(
  p_limit  INTEGER DEFAULT 20,
  p_cursor TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (post_id UUID)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
  SELECT p.id
  FROM posts p
  JOIN follows f ON f.following_id = p.user_id AND f.follower_id = auth.uid()
  WHERE p.reply_to_id IS NULL
    AND p.community_id IS NULL
    AND p.is_hidden = FALSE
    AND p.type <> 'reel'
    AND (p_cursor IS NULL OR p.created_at < p_cursor)
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.following_feed(INTEGER, TIMESTAMPTZ) TO authenticated;

-- Shadow comparison: run both orderings for a sample of viewers and store
-- them, so the ranker can be judged on real data before a single user sees
-- it. Dropped once the rollout finishes.
CREATE TABLE IF NOT EXISTS public.feed_shadow_runs (
  id            BIGSERIAL PRIMARY KEY,
  viewer_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ranked_ids    UUID[] NOT NULL,
  chrono_ids    UUID[] NOT NULL,
  overlap_count SMALLINT NOT NULL,
  out_of_network SMALLINT NOT NULL
);

ALTER TABLE public.feed_shadow_runs ENABLE ROW LEVEL SECURITY;
-- No client policies: this is operator data, read with the service role.

-- The dead get_feed RPC: defined twice, called by nothing, and stale since
-- before community_id, visibility, close_friends, and boost existed. It would
-- fail against the current posts shape if anything ever called it.
DROP FUNCTION IF EXISTS public.get_feed(UUID, INT, TIMESTAMPTZ);
