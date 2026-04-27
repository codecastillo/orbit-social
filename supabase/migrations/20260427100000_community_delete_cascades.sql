-- Make community delete actually work: events.community_id had no ON DELETE
-- action, defaulting to NO ACTION/RESTRICT, so any event tied to the room
-- blocked the DELETE. Detach events on community delete (we don't want to
-- nuke the events themselves — they may be cross-posted or important).
ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_community_id_fkey;
ALTER TABLE public.events
  ADD CONSTRAINT events_community_id_fkey
  FOREIGN KEY (community_id) REFERENCES public.communities(id)
  ON DELETE SET NULL;

-- SECURITY DEFINER deletion path. Bypasses RLS so we can confirm a row was
-- actually deleted (the client-side delete returns success even when RLS
-- silently filtered it out). Re-checks ownership inside the function.
CREATE OR REPLACE FUNCTION public.delete_community(p_community_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  owner UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT created_by INTO owner FROM public.communities WHERE id = p_community_id;
  IF owner IS NULL THEN
    RAISE EXCEPTION 'community not found';
  END IF;
  IF owner <> uid THEN
    RAISE EXCEPTION 'not authorized — only the owner can delete this room';
  END IF;

  DELETE FROM public.communities WHERE id = p_community_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_community(UUID) TO authenticated;
