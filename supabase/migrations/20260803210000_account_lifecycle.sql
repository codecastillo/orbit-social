-- Account lifecycle gaps: deletion is the only exit (no reversible pause),
-- and changing a username silently breaks every existing link, mention card,
-- and OG preview pointing at the old handle.

-- Deactivation: reversible, undone by signing back in. Distinct from
-- deletion, which stays immediate and permanent.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_deactivated_idx
  ON public.profiles (deactivated_at) WHERE deactivated_at IS NOT NULL;

-- A deactivated account's posts leave circulation without being destroyed.
-- Restating the whole posts policy because block and privacy rules share it:
-- edit the three together or one silently drops another's rule.
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (
    NOT is_hidden
    AND NOT public.blocks_between(auth.uid(), user_id)
    AND (
      auth.uid() = user_id
      OR NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = posts.user_id
          AND (p.is_private OR p.deactivated_at IS NOT NULL)
      )
      OR EXISTS (
        SELECT 1 FROM follows f
        WHERE f.following_id = posts.user_id AND f.follower_id = auth.uid()
      )
    )
  );

-- Old handles keep resolving. A row is written whenever a username changes,
-- so /oldname can redirect instead of 404ing.
-- TEXT, matching profiles.username; lookups lower() both sides since the
-- column has no citext extension behind it.
CREATE TABLE IF NOT EXISTS public.username_history (
  old_username TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.username_history ENABLE ROW LEVEL SECURITY;

-- Public read: the whole point is resolving a stale link for any visitor.
-- Writes happen only in the trigger below.
DROP POLICY IF EXISTS "Username history is public" ON public.username_history;
CREATE POLICY "Username history is public"
  ON public.username_history FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.record_username_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    -- Free the old handle's history row if someone else once held it, then
    -- claim it for this account; the newest owner is the one worth
    -- redirecting to.
    DELETE FROM username_history WHERE old_username = OLD.username;
    INSERT INTO username_history (old_username, user_id)
    VALUES (OLD.username, NEW.id);

    -- A handle being reused must stop redirecting to its previous owner.
    DELETE FROM username_history WHERE old_username = NEW.username;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_username_change ON public.profiles;
CREATE TRIGGER trg_record_username_change
  AFTER UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.record_username_change();
