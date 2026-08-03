-- Wave 4: creation tool parity.

-- Server-synced post drafts so a draft started on one device finishes on
-- another. Media stays on-device (uploading unpublished media would cost
-- storage for posts that may never exist); draft_data carries the composer
-- state: poll, visibility, content warning, location, scheduled time.
CREATE TABLE IF NOT EXISTS public.post_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  draft_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_drafts_user_idx
  ON public.post_drafts (user_id, updated_at DESC);

ALTER TABLE public.post_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own drafts" ON public.post_drafts;
CREATE POLICY "Users manage own drafts"
  ON public.post_drafts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Alt text for accessibility, written by both composers and read by every
-- image renderer.
ALTER TABLE public.post_media
  ADD COLUMN IF NOT EXISTS alt_text TEXT CHECK (char_length(alt_text) <= 1000);
