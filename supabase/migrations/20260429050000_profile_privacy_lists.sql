-- Per-list privacy toggles. Independent from `is_private` (which gates
-- post visibility) so a public user can still hide their followers list
-- or their likes tab without going fully private.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS private_followers BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS private_likes BOOLEAN NOT NULL DEFAULT false;
