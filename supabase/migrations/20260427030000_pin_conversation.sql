-- Per-member pinned-conversation flag, lets a user pin a thread in their
-- inbox without affecting the other side.
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_conversation_members_pinned
  ON public.conversation_members(user_id)
  WHERE is_pinned = TRUE;
