-- Communities: enforce 3-way join policy (public / approval / invite),
-- recompute drifted member counts, and stream member changes via realtime.

-- 1. Add the policy column and a join_requests table.
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS join_policy TEXT NOT NULL DEFAULT 'public'
  CHECK (join_policy IN ('public', 'approval', 'invite'));

-- Backfill: rooms with is_private=true that haven't set a policy are 'invite'.
UPDATE public.communities
SET join_policy = 'invite'
WHERE is_private = TRUE AND join_policy = 'public';

CREATE TABLE IF NOT EXISTS public.community_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  UNIQUE (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_community_join_requests_pending
  ON public.community_join_requests(community_id) WHERE status = 'pending';

ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members or requester can view requests"
  ON public.community_join_requests;
CREATE POLICY "Members or requester can view requests"
  ON public.community_join_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_join_requests.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- 2. Tighten community_members INSERT: self-join is only allowed when the
--    community is public; approval/invite must go through SECURITY DEFINER fns.
DROP POLICY IF EXISTS "Users can join communities" ON public.community_members;
CREATE POLICY "Users can self-join public communities"
  ON public.community_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_members.community_id
        AND c.join_policy = 'public'
    )
  );

-- 3. SECURITY DEFINER helpers for the approval / invite flows.
CREATE OR REPLACE FUNCTION public.community_join_or_request(p_community_id UUID)
RETURNS TEXT  -- 'joined' | 'requested' | 'invite_only'
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  policy TEXT;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT join_policy INTO policy FROM public.communities WHERE id = p_community_id;
  IF policy IS NULL THEN
    RAISE EXCEPTION 'community not found';
  END IF;

  -- Already a member? No-op.
  IF EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id AND user_id = uid
  ) THEN
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
  ELSE  -- invite
    RETURN 'invite_only';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_join_or_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_approve_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.community_join_requests%ROWTYPE;
  uid UUID := auth.uid();
BEGIN
  SELECT * INTO req FROM public.community_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = req.community_id AND user_id = uid AND role IN ('owner', 'moderator')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (req.community_id, req.user_id, 'member')
  ON CONFLICT DO NOTHING;

  UPDATE public.community_join_requests
  SET status = 'approved', decided_at = NOW()
  WHERE id = p_request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.community_approve_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_reject_request(p_request_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.community_join_requests%ROWTYPE;
  uid UUID := auth.uid();
BEGIN
  SELECT * INTO req FROM public.community_join_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = req.community_id AND user_id = uid AND role IN ('owner', 'moderator')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.community_join_requests
  SET status = 'rejected', decided_at = NOW()
  WHERE id = p_request_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.community_reject_request(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.community_invite_user(p_community_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id AND user_id = uid AND role IN ('owner', 'moderator')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (p_community_id, p_user_id, 'member')
  ON CONFLICT DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.community_invite_user(UUID, UUID) TO authenticated;

-- 4. Recompute member_count for every community to fix prior drift
--    (the createCommunity path inserted with member_count=1, then the trigger
--    bumped it to 2 on the owner's row insert).
UPDATE public.communities c
SET member_count = COALESCE((
  SELECT COUNT(*) FROM public.community_members cm WHERE cm.community_id = c.id
), 0);

-- 5. Realtime: stream member_count changes + member roster changes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'communities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.communities';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.community_members';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_join_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.community_join_requests';
  END IF;
END $$;

ALTER TABLE public.community_members REPLICA IDENTITY FULL;
