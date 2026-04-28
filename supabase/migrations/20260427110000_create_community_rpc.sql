-- Atomic community-creation: prior client-side path inserted the community
-- then inserted the owner into community_members. The new INSERT policy on
-- community_members only allows self-join when join_policy='public', so
-- creating a room with policy='approval' or 'invite' failed at the owner
-- insert step. This SECURITY DEFINER function bypasses RLS and does both in
-- one transaction.
CREATE OR REPLACE FUNCTION public.create_community(
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT,
  p_join_policy TEXT DEFAULT 'public'
)
RETURNS public.communities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  result public.communities;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_join_policy NOT IN ('public', 'approval', 'invite') THEN
    RAISE EXCEPTION 'invalid join_policy';
  END IF;

  INSERT INTO public.communities (
    name, slug, description, created_by,
    is_private, join_policy, member_count
  ) VALUES (
    p_name, p_slug, p_description, uid,
    p_join_policy = 'invite', p_join_policy, 0
  )
  RETURNING * INTO result;

  -- Owner membership; trigger bumps member_count to 1.
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (result.id, uid, 'owner');

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_community(TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
