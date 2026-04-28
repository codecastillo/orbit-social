-- Creating a room no longer auto-adds the creator as a member. They appear
-- in 'All rooms' and have to tap Join like everyone else; the room then
-- shows up in 'My rooms'. This matches the user's mental model that
-- creating ≠ joining.
--
-- community_join_or_request gains an owner-bypass: when the caller is the
-- room's created_by, insert as role 'owner' regardless of join policy
-- (otherwise approval / invite rooms would lock the creator out of their
-- own room).

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

  -- Intentionally NOT inserting into community_members here.
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.community_join_or_request(p_community_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  policy TEXT;
  creator UUID;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT join_policy, created_by INTO policy, creator
  FROM public.communities WHERE id = p_community_id;
  IF policy IS NULL THEN
    RAISE EXCEPTION 'community not found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id AND user_id = uid
  ) THEN
    RETURN 'joined';
  END IF;

  -- Owner bypass: the room creator can always join their own room
  -- regardless of join policy, with role 'owner'.
  IF creator = uid THEN
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (p_community_id, uid, 'owner');
    RETURN 'joined';
  END IF;

  IF policy = 'public' THEN
    INSERT INTO public.community_members (community_id, user_id, role)
    VALUES (p_community_id, uid, 'member');
    RETURN 'joined';
  ELSIF policy = 'approval' THEN
    INSERT INTO public.community_join_requests (community_id, user_id, status)
    VALUES (p_community_id, uid, 'pending')
    ON CONFLICT (community_id, user_id) DO UPDATE SET status = 'pending', decided_at = NULL;
    RETURN 'requested';
  ELSE
    RETURN 'invite_only';
  END IF;
END;
$$;

-- Backfill: for any existing room whose only member is its creator (the
-- old auto-insert behavior), remove that membership row so existing
-- "I created this so it's pinned to My rooms" rows clear out. This only
-- removes solo owner-rows where the user has done nothing else; if anyone
-- else has joined or the owner has already engaged, it's a no-op.
DELETE FROM public.community_members cm
USING public.communities c
WHERE cm.community_id = c.id
  AND cm.user_id = c.created_by
  AND cm.role = 'owner'
  AND NOT EXISTS (
    SELECT 1 FROM public.community_members cm2
    WHERE cm2.community_id = c.id AND cm2.user_id <> c.created_by
  );

-- Recompute member_count to reflect the cleared owner rows.
UPDATE public.communities c
SET member_count = (
  SELECT COUNT(*) FROM public.community_members cm
  WHERE cm.community_id = c.id
);
