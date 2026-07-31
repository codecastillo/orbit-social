-- Per-user DM read receipts preference. Reciprocal: a user who turns this
-- off neither shares their "Seen" state nor sees anyone else's.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS read_receipts_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.read_receipts_enabled IS
  'When false, the user neither shares their DM read state nor sees others''. last_read_at still updates for unread counts.';
