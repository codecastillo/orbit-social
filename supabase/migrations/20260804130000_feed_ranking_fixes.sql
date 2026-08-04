-- Two fixes to feed_for_you, both found by actually running it rather than
-- by any check the build performs.
--
-- 1. POWER() returns double precision, so the composed score came back as
--    double precision while the function declares numeric, and every call
--    failed with a structure mismatch. Cast at the point of return.
--
-- 2. The candidate window was hardcoded at 7 days. At low posting volume the
--    newest post is easily older than that, and the feed comes back empty
--    with nothing to indicate why. The window is a performance guard on the
--    candidate scan, not a correctness rule (the recency term is what buries
--    old posts), so it belongs in config: generous while the platform is
--    small, tightened as volume arrives.
UPDATE public.feed_ranking_config
SET weights = weights || '{"candidate_window_days": 365, "source_window_hours": 8760}'::jsonb,
    updated_at = now()
WHERE id;

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
  v_window INTERVAL;
  v_src_window INTERVAL;
BEGIN
  SELECT weights INTO w FROM feed_ranking_config WHERE id;

  v_window := ((w->>'candidate_window_days')::numeric || ' days')::interval;
  v_src_window := ((w->>'source_window_hours')::numeric || ' hours')::interval;

  SELECT LEAST(1.0, COUNT(*)::numeric / (w->>'confidence_target')::numeric)
    INTO v_conf
  FROM post_likes
  WHERE user_id = v_viewer AND created_at > now() - INTERVAL '30 days';

  v_conf := COALESCE(v_conf, 0);

  SELECT string_agg('(^|\W)' || regexp_replace(word, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '(\W|$)', '|')
    INTO v_muted_pattern
  FROM muted_words WHERE user_id = v_viewer;

  RETURN QUERY
  WITH
  seen AS (
    SELECT pi.post_id, SUM(pi.views) AS views, SUM(pi.dwell_ms) AS dwell_ms
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
      AND p.created_at > now() - v_window
      AND NOT (p.id = ANY(p_exclude))
      AND p.user_id <> v_viewer
      AND NOT EXISTS (SELECT 1 FROM mutes m WHERE m.user_id = v_viewer AND m.muted_id = p.user_id
                        AND (m.expires_at IS NULL OR m.expires_at > now()))
      AND NOT EXISTS (SELECT 1 FROM post_feedback pf WHERE pf.user_id = v_viewer AND pf.post_id = p.id)
      AND (v_muted_pattern IS NULL OR COALESCE(p.content, '') !~* v_muted_pattern)
      AND NOT EXISTS (SELECT 1 FROM seen s WHERE s.post_id = p.id
                        AND (s.views >= 3 OR s.dwell_ms > 3000))
  ),
  s1_following AS (
    SELECT b.id, 'following'::text AS src FROM base b
    WHERE EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = v_viewer AND f.following_id = b.user_id)
      AND b.created_at > now() - v_src_window
    ORDER BY b.created_at DESC LIMIT 150
  ),
  s2_second_degree AS (
    SELECT b.id, 'second_degree'::text AS src FROM base b
    WHERE b.created_at > now() - v_src_window
      AND EXISTS (
        SELECT 1 FROM post_likes pl
        JOIN follows f ON f.following_id = pl.user_id AND f.follower_id = v_viewer
        WHERE pl.post_id = b.id
      )
    ORDER BY b.created_at DESC LIMIT 60
  ),
  s3_topic AS (
    SELECT b.id, 'topic'::text AS src FROM base b
    WHERE b.created_at > now() - v_src_window
      AND EXISTS (
        SELECT 1 FROM post_hashtags ph
        JOIN viewer_topic_affinity vta ON vta.hashtag_id = ph.hashtag_id AND vta.viewer_id = v_viewer
        WHERE ph.post_id = b.id
      )
    ORDER BY b.created_at DESC LIMIT 60
  ),
  s5_trending AS (
    SELECT b.id, 'trending'::text AS src FROM base b
    WHERE b.created_at > now() - v_src_window
    ORDER BY (b.like_count + b.comment_count * 6 + b.repost_count * 8 + b.bookmark_count * 5) DESC,
             b.created_at DESC
    LIMIT 30
  ),
  s6_cold_start AS (
    SELECT b.id, 'cold_start'::text AS src FROM base b
    JOIN profiles pr ON pr.id = b.user_id
    WHERE b.created_at > now() - v_src_window
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
    SELECT b.id, c.src, b.user_id,
      (
        (w->>'w_author_affinity')::numeric * COALESCE(vaa.score, 0)::numeric * v_conf
      + (w->>'w_topic_affinity')::numeric * COALESCE((
          SELECT MAX(vta.score) FROM post_hashtags ph
          JOIN viewer_topic_affinity vta ON vta.hashtag_id = ph.hashtag_id
          WHERE ph.post_id = b.id AND vta.viewer_id = v_viewer
        ), 0)::numeric * v_conf
      + (w->>'w_value_rate')::numeric * (
          (b.like_count + b.comment_count * 6 + b.repost_count * 8 + b.bookmark_count * 5)::numeric
          / (COALESCE(imp.impressions, 0) + (w->>'shrink_k')::numeric)
        )
      + (w->>'w_recency')::numeric * POWER(0.5,
          EXTRACT(EPOCH FROM (now() - b.created_at)) / 3600.0
          / CASE WHEN b.type = 'video' THEN 24 WHEN b.type = 'image' THEN 12 ELSE 6 END)::numeric
      + (w->>'w_exploration')::numeric * CASE WHEN c.src = 'cold_start' THEN 1 ELSE 0 END
      + (w->>'w_media')::numeric * CASE WHEN EXISTS (
          SELECT 1 FROM post_media pm WHERE pm.post_id = b.id) THEN 1 ELSE 0 END
      + (0.45 * (1 - v_conf)) * POWER(0.5,
          EXTRACT(EPOCH FROM (now() - b.created_at)) / 3600.0 / 12)::numeric
      + CASE WHEN s.post_id IS NOT NULL THEN (w->>'seen_penalty')::numeric ELSE 0 END
      )::numeric AS raw_score
    FROM candidates c
    JOIN base b ON b.id = c.id
    LEFT JOIN viewer_author_affinity vaa ON vaa.viewer_id = v_viewer AND vaa.author_id = b.user_id
    LEFT JOIN seen s ON s.post_id = b.id
    LEFT JOIN LATERAL (
      SELECT SUM(pi.views)::numeric AS impressions
      FROM post_impressions pi WHERE pi.post_id = b.id
    ) imp ON TRUE
  ),
  diversified AS (
    SELECT id, src, raw_score,
           (raw_score * GREATEST(0.1,
             1 - (w->>'diversity_step')::numeric
                 * (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY raw_score DESC) - 1)
           ))::numeric AS final_score
    FROM scored
  )
  SELECT d.id, d.final_score, d.src
  FROM diversified d
  ORDER BY d.final_score DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.feed_for_you(INTEGER, UUID[]) TO authenticated;
