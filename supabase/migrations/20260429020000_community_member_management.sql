-- Owners need to be able to remove members and change member roles, but
-- the existing community_members policies only let a user delete their
-- own membership row. These two SECURITY DEFINER RPCs let an owner act
-- on any member of their own room while preventing escalation: nobody
-- can promote themselves or remove the owner via these functions.

CREATE OR REPLACE FUNCTION public.community_remove_member(
  p_community_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_role TEXT;
  v_target_role TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.community_members
  WHERE community_id = p_community_id AND user_id = v_caller;

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'only the owner can remove members';
  END IF;

  IF p_user_id = v_caller THEN
    RAISE EXCEPTION 'owner cannot remove themselves; transfer ownership first';
  END IF;

  SELECT role INTO v_target_role
  FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'cannot remove another owner';
  END IF;

  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_set_member_role(
  p_community_id UUID,
  p_user_id UUID,
  p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_caller_role TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;

  IF p_role NOT IN ('moderator', 'member') THEN
    -- 'owner' is intentionally excluded — needs a separate
    -- transfer-ownership flow that decrements the previous owner.
    RAISE EXCEPTION 'role must be moderator or member';
  END IF;

  SELECT role INTO v_caller_role
  FROM public.community_members
  WHERE community_id = p_community_id AND user_id = v_caller;

  IF v_caller_role IS DISTINCT FROM 'owner' THEN
    RAISE EXCEPTION 'only the owner can change member roles';
  END IF;

  IF p_user_id = v_caller THEN
    RAISE EXCEPTION 'owner cannot change their own role';
  END IF;

  UPDATE public.community_members
  SET role = p_role
  WHERE community_id = p_community_id AND user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_remove_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_set_member_role(UUID, UUID, TEXT) TO authenticated;
