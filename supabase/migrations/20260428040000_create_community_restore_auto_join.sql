-- Revert: creating a room auto-adds the creator as the owner-member again.
-- Without this, the new room appears in 'All rooms' but the creator can't
-- post in it (header reads "Join this community to start posting") even
-- though the Owner pill renders. Forcing them to tap Join twice — once
-- after create, then again to actually become a member — was confusing.
--
-- The size issue that motivated the previous removal was actually a tile
-- layout problem (the FeaturedTrio hero was rendering between MY ROOMS and
-- the rest of the page); that's been fixed independently with uniform 320px
-- tiles, so creating-as-member is safe again.
--
-- The owner-bypass in community_join_or_request stays in place as a safety
-- net for legacy rooms.

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

-- Backfill: any community whose created_by has no community_members row
-- gets one. Catches rooms created during the no-auto-join window.
INSERT INTO public.community_members (community_id, user_id, role)
SELECT c.id, c.created_by, 'owner'
FROM public.communities c
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_members cm
  WHERE cm.community_id = c.id AND cm.user_id = c.created_by
);

-- Recompute member_count to reflect the restored owner rows.
UPDATE public.communities c
SET member_count = (
  SELECT COUNT(*) FROM public.community_members cm
  WHERE cm.community_id = c.id
);
