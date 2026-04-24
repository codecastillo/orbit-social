-- Add scheduled_at field to posts for post scheduling
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficiently querying scheduled posts that are ready to publish
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at
  ON public.posts (scheduled_at)
  WHERE scheduled_at IS NOT NULL AND is_hidden = true;

-- Index for fetching a user's scheduled posts
CREATE INDEX IF NOT EXISTS idx_posts_user_scheduled
  ON public.posts (user_id, scheduled_at)
  WHERE scheduled_at IS NOT NULL AND is_hidden = true;

-- Function to auto-publish scheduled posts that are past their scheduled time
CREATE OR REPLACE FUNCTION publish_scheduled_posts()
RETURNS INTEGER AS $$
DECLARE
  published_count INTEGER;
BEGIN
  UPDATE public.posts
  SET is_hidden = false,
      updated_at = NOW()
  WHERE scheduled_at IS NOT NULL
    AND scheduled_at <= NOW()
    AND is_hidden = true;

  GET DIAGNOSTICS published_count = ROW_COUNT;
  RETURN published_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
