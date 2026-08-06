-- Custom feeds: a feed you define, pinned beside For you and Following.
--
-- This is the feature people name as the reason to move from X to Bluesky,
-- and Orbit can offer it cheaply because feed_for_you already does candidate
-- generation, safety filtering, and scoring. A custom feed is a narrower
-- candidate query through machinery that exists.
--
-- The definition is deliberately small: hashtags, keywords, and whether to
-- restrict to people you follow. Anything richer becomes a query language
-- nobody can debug, and the three together already express most of what
-- people build on other platforms.

CREATE TABLE IF NOT EXISTS public.custom_feeds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(TRIM(name)) BETWEEN 1 AND 30),
  -- Tag names without the #, lowercased by the client. A post matches if it
  -- carries any of them.
  hashtags    TEXT[] NOT NULL DEFAULT '{}',
  -- Substrings matched against post content, ORed with the hashtags.
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  -- Narrows the whole feed to accounts the owner follows.
  following_only BOOLEAN NOT NULL DEFAULT FALSE,
  -- Media filter: NULL means everything.
  media_only  TEXT CHECK (media_only IN ('image', 'video')),
  -- Pinned feeds appear as tabs; unpinned ones live in a list. Ordering is
  -- by position so someone can put their most-read feed first.
  is_pinned   BOOLEAN NOT NULL DEFAULT TRUE,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A feed with no hashtags and no keywords matches everything, which is
  -- just the main feed wearing a different name.
  CHECK (cardinality(hashtags) > 0 OR cardinality(keywords) > 0),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS custom_feeds_user_idx
  ON public.custom_feeds (user_id, position, created_at);

ALTER TABLE public.custom_feeds ENABLE ROW LEVEL SECURITY;

-- Private for now. Sharing a feed by link is the obvious next step and the
-- reason people love this feature elsewhere, but a shared feed needs a
-- public read path and a copy flow, and shipping the private half first
-- means the schema does not have to be guessed at.
CREATE POLICY "Custom feeds are private to their owner"
  ON public.custom_feeds FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

/**
 * One page of a custom feed.
 *
 * SECURITY INVOKER on purpose: the posts SELECT policy already enforces
 * blocks, private accounts, and deactivation, and reimplementing any of that
 * here would be a second copy of the rules that could drift from the first.
 *
 * Chronological rather than ranked. A feed someone defined by hand is a
 * statement about what they want to see, and reordering it would be the app
 * overruling that. Ranked custom feeds can come later as an option.
 */
CREATE OR REPLACE FUNCTION public.custom_feed_posts(
  p_feed_id UUID,
  p_limit   INTEGER DEFAULT 20,
  p_before  TIMESTAMPTZ DEFAULT NULL
)
RETURNS SETOF public.posts
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  f public.custom_feeds%ROWTYPE;
BEGIN
  SELECT * INTO f FROM public.custom_feeds
  WHERE id = p_feed_id AND user_id = v_viewer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'feed not found';
  END IF;

  RETURN QUERY
  SELECT p.*
  FROM public.posts p
  WHERE p.reply_to_id IS NULL
    AND p.community_id IS NULL
    AND p.is_hidden = FALSE
    AND p.type <> 'repost'
    AND (p_before IS NULL OR p.created_at < p_before)
    AND (
      cardinality(f.hashtags) = 0
      OR EXISTS (
        SELECT 1 FROM public.post_hashtags ph
        JOIN public.hashtags h ON h.id = ph.hashtag_id
        WHERE ph.post_id = p.id AND lower(h.name) = ANY (f.hashtags)
      )
      OR EXISTS (
        SELECT 1 FROM unnest(f.keywords) AS kw
        WHERE p.content ILIKE '%' || kw || '%'
      )
    )
    AND (
      NOT f.following_only
      OR EXISTS (
        SELECT 1 FROM public.follows fo
        WHERE fo.follower_id = v_viewer AND fo.following_id = p.user_id
      )
    )
    AND (
      f.media_only IS NULL
      OR EXISTS (
        SELECT 1 FROM public.post_media pm
        WHERE pm.post_id = p.id
          AND (
            (f.media_only = 'image' AND pm.type IN ('image', 'gif'))
            OR (f.media_only = 'video' AND pm.type = 'video')
          )
      )
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_feed_posts(UUID, INTEGER, TIMESTAMPTZ)
  TO authenticated;
