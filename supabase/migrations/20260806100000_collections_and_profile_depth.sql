-- Two Wave 2 features that need columns, in one migration because both are
-- additive and neither changes an existing contract.
--
-- 1. BOOKMARK COLLECTIONS AND NOTES
--
-- Saving something is currently a flat list with no way to sort it and no way
-- to record why you kept it. X puts folders behind a paid tier; nobody offers
-- the note, which is the part that makes a save findable a year later.
--
-- Folders are a separate table rather than a text column on bookmarks so a
-- collection can be renamed once instead of on every row, and so an empty
-- collection can exist while you fill it.

CREATE TABLE IF NOT EXISTS public.bookmark_collections (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(TRIM(name)) BETWEEN 1 AND 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Two collections with the same name in one account are a mistake every
  -- time, and the picker cannot tell them apart.
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS bookmark_collections_user_idx
  ON public.bookmark_collections (user_id, created_at DESC);

-- SET NULL, not CASCADE: deleting a collection must not delete the saves
-- inside it. They return to the unfiled list, which is where they started.
ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS collection_id UUID
    REFERENCES public.bookmark_collections(id) ON DELETE SET NULL;

ALTER TABLE public.bookmarks
  ADD COLUMN IF NOT EXISTS note TEXT CHECK (char_length(note) <= 280);

CREATE INDEX IF NOT EXISTS bookmarks_collection_idx
  ON public.bookmarks (collection_id) WHERE collection_id IS NOT NULL;

-- bookmarks has SELECT, INSERT and DELETE policies and no UPDATE policy,
-- because until now nothing about a bookmark could change. Filing one into a
-- collection or writing a note is an UPDATE, and without this RLS refuses it
-- by matching zero rows, which reports success and saves nothing.
DROP POLICY IF EXISTS "Users can edit own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can edit own bookmarks"
  ON public.bookmarks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.bookmark_collections ENABLE ROW LEVEL SECURITY;

-- Collections are private. There is no sharing surface for them and no
-- promise anywhere that there might be, so the policy is the whole story.
CREATE POLICY "Collections are private to their owner"
  ON public.bookmark_collections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. PROFILE DEPTH
--
-- profiles carries a single `website` column, so a person with a shop, a
-- portfolio, and a newsletter has to pick one. Pronouns have no home at all,
-- and `interests` is collected during onboarding and then never shown or
-- edited again.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pronouns TEXT CHECK (char_length(pronouns) <= 40);

-- An array of {label, url} rather than a table: it is read whole every time,
-- written whole every time, and capped at five, so a join would buy nothing.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(links) = 'array' AND jsonb_array_length(links) <= 5);

-- A status is a sentence with an expiry, the way Instagram notes and Discord
-- custom statuses work. Expiry is required in spirit: a status with no end
-- becomes a second bio nobody remembers to clear, so the client always sets
-- one and anything past it is treated as absent.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status_text TEXT CHECK (char_length(status_text) <= 60);
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.links IS
  'Up to five {label, url} objects. Replaces the single website column, which is kept for now so existing profiles and every query selecting it keep working.';
COMMENT ON COLUMN public.profiles.status_expires_at IS
  'Readers must treat a status with a past expiry as absent; nothing clears the text itself.';
