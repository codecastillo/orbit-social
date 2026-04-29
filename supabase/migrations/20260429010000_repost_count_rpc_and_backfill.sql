-- Repost count was being bumped by a client-side UPDATE inside
-- createRepost(), but RLS blocks UPDATE on a row owned by another user
-- so the bump silently fails (the catch in JS swallows the error). The
-- result: repost rows accumulate but `posts.repost_count` stays at 0,
-- so the feed/post-detail UI never renders a count.
--
-- Fix: SECURITY DEFINER RPCs that bypass RLS for this single-column
-- bump, plus a backfill so every existing post's count matches the
-- actual number of repost rows pointing at it.

CREATE OR REPLACE FUNCTION public.increment_post_reposts(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET repost_count = COALESCE(repost_count, 0) + 1
  WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_post_reposts(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET repost_count = GREATEST(COALESCE(repost_count, 0) - 1, 0)
  WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_post_reposts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_post_reposts(UUID) TO authenticated;

-- Backfill: recompute every post's repost_count from the actual count
-- of repost-typed rows that point at it via parent_post_id.
WITH counted AS (
  SELECT parent_post_id AS id, COUNT(*) AS n
  FROM public.posts
  WHERE type = 'repost' AND parent_post_id IS NOT NULL
  GROUP BY parent_post_id
)
UPDATE public.posts p
SET repost_count = COALESCE(c.n, 0)
FROM counted c
WHERE p.id = c.id
  AND p.repost_count IS DISTINCT FROM c.n;

-- Also reset posts that should be 0 (had stale non-zero count but no
-- repost rows pointing at them anymore).
UPDATE public.posts p
SET repost_count = 0
WHERE p.repost_count IS DISTINCT FROM 0
  AND NOT EXISTS (
    SELECT 1 FROM public.posts r
    WHERE r.type = 'repost' AND r.parent_post_id = p.id
  );
