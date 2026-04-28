-- Add avatar/cover support to the create RPC + an update RPC the owner uses
-- to swap images / rename / re-describe the room from inside it.

CREATE OR REPLACE FUNCTION public.create_community(
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT,
  p_join_policy TEXT DEFAULT 'public',
  p_avatar_url TEXT DEFAULT NULL,
  p_cover_url TEXT DEFAULT NULL
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
    is_private, join_policy, member_count,
    avatar_url, cover_url
  ) VALUES (
    p_name, p_slug, p_description, uid,
    p_join_policy = 'invite', p_join_policy, 0,
    p_avatar_url, p_cover_url
  )
  RETURNING * INTO result;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (result.id, uid, 'owner');

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_community(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

-- Owner-only edit. Pass NULL to leave a field unchanged.
CREATE OR REPLACE FUNCTION public.update_community(
  p_community_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL,
  p_cover_url TEXT DEFAULT NULL,
  p_clear_avatar BOOLEAN DEFAULT FALSE,
  p_clear_cover BOOLEAN DEFAULT FALSE
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
GRANT EXECUTE ON FUNCTION public.update_community(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN)
  TO authenticated;
