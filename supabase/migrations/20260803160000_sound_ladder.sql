-- Wave D: the sound ladder. Sounds have existed since 00011 with no owner,
-- no join to posts, and no write path; this wires them as a metadata
-- attribution ladder (Expo Go cannot extract or mix audio, so a clip's own
-- media doubles as its original sound).

ALTER TABLE public.sounds
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS sound_id UUID REFERENCES public.sounds(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS posts_sound_idx
  ON public.posts (sound_id) WHERE sound_id IS NOT NULL;

DROP POLICY IF EXISTS "Users create own sounds" ON public.sounds;
CREATE POLICY "Users create own sounds"
  ON public.sounds FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- use_count has never had a maintainer; clients call this when a clip
-- publishes with a sound attached.
CREATE OR REPLACE FUNCTION public.increment_sound_use(p_sound_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE sounds SET use_count = COALESCE(use_count, 0) + 1 WHERE id = p_sound_id;
$$;
