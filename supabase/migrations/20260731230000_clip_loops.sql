-- Loop-first clips identity. Loops measure held attention (someone chose to
-- keep watching), which is emotionally different from a view, and they give
-- small creators a visible number on day one.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS loop_count BIGINT NOT NULL DEFAULT 0;

-- Clients debounce loop completions locally and flush a batch; RLS blocks
-- direct count updates on other people's posts, hence SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.increment_clip_loops(p_post_id UUID, p_loops INT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE posts
  SET loop_count = loop_count + LEAST(GREATEST(p_loops, 0), 100)
  WHERE id = p_post_id AND type = 'reel';
$$;

-- The Loop lane needs real durations; uploaders populate this from the
-- captured or selected video's metadata.
ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS duration_ms INT;
