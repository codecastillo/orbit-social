-- A room's join policy could only ever be set at creation. Nothing in either
-- client, and no RPC, could change it afterwards, so a room started as public
-- stayed public forever and an owner who wanted to close it had to delete the
-- room and rebuild it. Room rules had the same problem: the column is read
-- everywhere and written only by create_community.
--
-- update_community gains both. The new parameters default to NULL and go at
-- the end, so every existing call keeps working unchanged.
--
-- is_private is kept in step with join_policy rather than left to drift. It
-- predates join_policy and still drives the communities SELECT policy, so a
-- room switched to invite-only that left is_private FALSE would change its
-- join rule while staying publicly listed.

CREATE OR REPLACE FUNCTION public.update_community(
  p_community_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_cover_url TEXT DEFAULT NULL,
  p_clear_avatar BOOLEAN DEFAULT FALSE,
  p_clear_cover BOOLEAN DEFAULT FALSE,
  p_join_policy TEXT DEFAULT NULL,
  p_rules JSONB DEFAULT NULL
)
RETURNS public.communities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  owner UUID;
  result public.communities;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_join_policy IS NOT NULL
     AND p_join_policy NOT IN ('public', 'approval', 'invite') THEN
    RAISE EXCEPTION 'invalid join policy';
  END IF;

  SELECT created_by INTO owner FROM public.communities WHERE id = p_community_id;
  IF owner IS NULL THEN
    RAISE EXCEPTION 'community not found';
  END IF;
  IF owner <> uid THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.communities
  SET
    name        = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    join_policy = COALESCE(p_join_policy, join_policy),
    is_private  = CASE WHEN p_join_policy IS NULL THEN is_private
                       ELSE p_join_policy = 'invite' END,
    rules       = COALESCE(p_rules, rules),
    avatar_url  = CASE WHEN p_clear_avatar THEN NULL
                       WHEN p_avatar_url IS NOT NULL THEN p_avatar_url
                       ELSE avatar_url END,
    cover_url   = CASE WHEN p_clear_cover THEN NULL
                       WHEN p_cover_url IS NOT NULL THEN p_cover_url
                       ELSE cover_url END
  WHERE id = p_community_id
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- The narrower 7-argument signature is dropped in the next migration: leaving
-- both callable makes every existing named-argument call ambiguous.
GRANT EXECUTE ON FUNCTION public.update_community(
  UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT, JSONB
) TO authenticated;

-- Opening a room that people were queuing for should not strand those
-- requests: nothing reads them once the policy is 'public', and a later
-- switch back to 'approval' would resurrect a stale queue.
CREATE OR REPLACE FUNCTION public.clear_join_requests_when_public()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.join_policy = 'public' AND OLD.join_policy IS DISTINCT FROM 'public' THEN
    DELETE FROM public.community_join_requests
    WHERE community_id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS communities_clear_requests_on_open ON public.communities;
CREATE TRIGGER communities_clear_requests_on_open
AFTER UPDATE OF join_policy ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.clear_join_requests_when_public();
