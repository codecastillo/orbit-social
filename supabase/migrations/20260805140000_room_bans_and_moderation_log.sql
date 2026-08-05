-- Room moderation stopped at "remove member", which does nothing lasting: the
-- removed person can rejoin a public room immediately, or queue again in an
-- approval room, and nothing records that a moderator acted at all.
--
-- This adds the two pieces that make removal mean something: a ban that
-- survives the rejoin, and a log so an owner can see what their moderators
-- have been doing. Both are room-scoped; platform-wide enforcement stays with
-- the reports queue.

CREATE TABLE IF NOT EXISTS public.community_bans (
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  banned_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason       TEXT,
  -- NULL means indefinite. A timed ban expires without anyone remembering to
  -- lift it, the same shape blocks and mutes already use.
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_bans_user_idx
  ON public.community_bans (user_id);

CREATE TABLE IF NOT EXISTS public.community_moderation_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id   UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  -- SET NULL rather than CASCADE: deleting a moderator's account must not
  -- erase the record of what they did.
  actor_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action         TEXT NOT NULL CHECK (action IN
                   ('ban', 'unban', 'remove_member', 'role_change',
                    'post_removed', 'post_pinned', 'post_unpinned')),
  target_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_post_id UUID,
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_moderation_log_room_idx
  ON public.community_moderation_log (community_id, created_at DESC);

ALTER TABLE public.community_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_moderation_log ENABLE ROW LEVEL SECURITY;

-- A banned person can see that they are banned and why. Hiding it would leave
-- them retrying a join that silently fails, and the account-status page makes
-- the same promise about platform enforcement.
CREATE POLICY "Bans are visible to the banned and to room staff"
  ON public.community_bans FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_bans.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

CREATE POLICY "Moderation log is visible to room staff"
  ON public.community_moderation_log FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_moderation_log.community_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'moderator')
    )
  );

-- No INSERT, UPDATE or DELETE policy on either table on purpose: writes go
-- through the SECURITY DEFINER functions below, so a client cannot forge a
-- ban or edit the log.

/** TRUE when this room currently bars this person. */
CREATE OR REPLACE FUNCTION public.community_is_banned(
  p_community_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_bans b
    WHERE b.community_id = p_community_id
      AND b.user_id = p_user_id
      AND (b.expires_at IS NULL OR b.expires_at > NOW())
  );
$$;

CREATE OR REPLACE FUNCTION public.community_ban_member(
  p_community_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
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
  IF p_user_id = v_caller THEN
    RAISE EXCEPTION 'cannot ban yourself';
  END IF;

  SELECT role INTO v_caller_role FROM public.community_members
  WHERE community_id = p_community_id AND user_id = v_caller;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'only owners and moderators can ban';
  END IF;

  SELECT role INTO v_target_role FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;

  IF v_target_role = 'owner' THEN
    RAISE EXCEPTION 'cannot ban the owner';
  END IF;
  -- A moderator outranking another moderator turns staff disputes into a
  -- race; only the owner can act on their own moderators.
  IF v_target_role = 'moderator' AND v_caller_role <> 'owner' THEN
    RAISE EXCEPTION 'only the owner can ban a moderator';
  END IF;

  INSERT INTO public.community_bans (community_id, user_id, banned_by, reason, expires_at)
  VALUES (p_community_id, p_user_id, v_caller, NULLIF(TRIM(p_reason), ''), p_expires_at)
  ON CONFLICT (community_id, user_id) DO UPDATE
    SET banned_by = EXCLUDED.banned_by,
        reason = EXCLUDED.reason,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW();

  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = p_user_id;

  -- Any pending request is answered by the ban itself.
  DELETE FROM public.community_join_requests
  WHERE community_id = p_community_id AND user_id = p_user_id AND status = 'pending';

  INSERT INTO public.community_moderation_log
    (community_id, actor_id, action, target_user_id, reason)
  VALUES (p_community_id, v_caller, 'ban', p_user_id, NULLIF(TRIM(p_reason), ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.community_unban_member(
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
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'must be authenticated';
  END IF;

  SELECT role INTO v_caller_role FROM public.community_members
  WHERE community_id = p_community_id AND user_id = v_caller;

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('owner', 'moderator') THEN
    RAISE EXCEPTION 'only owners and moderators can lift a ban';
  END IF;

  DELETE FROM public.community_bans
  WHERE community_id = p_community_id AND user_id = p_user_id;

  INSERT INTO public.community_moderation_log
    (community_id, actor_id, action, target_user_id)
  VALUES (p_community_id, v_caller, 'unban', p_user_id);
END;
$$;

-- A ban that only removes membership is a suggestion: without this the person
-- rejoins a public room on their next tap.
DROP POLICY IF EXISTS "Users can self-join public communities" ON public.community_members;
CREATE POLICY "Users can self-join public communities"
  ON public.community_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.communities c
      WHERE c.id = community_members.community_id
        AND c.join_policy = 'public'
    )
    AND NOT public.community_is_banned(community_members.community_id, auth.uid())
  );

-- The approval and invite paths bypass that policy by design, so each one has
-- to refuse a banned person itself. Bodies below are the originals with only
-- the ban guard added: the return values are a contract both clients read
-- ("joined" | "requested" | "invite_only"), and decided_at is written by the
-- request screens, so neither can be quietly modernised here.
CREATE OR REPLACE FUNCTION public.community_join_or_request(p_community_id UUID)
RETURNS TEXT
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

  IF public.community_is_banned(p_community_id, uid) THEN
    RAISE EXCEPTION 'banned from this room';
  END IF;

  SELECT join_policy INTO policy FROM public.communities WHERE id = p_community_id;
  IF policy IS NULL THEN
    RAISE EXCEPTION 'community not found';
  END IF;

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
  ELSE
    RETURN 'invite_only';
  END IF;
END;
$$;

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

  IF public.community_is_banned(req.community_id, req.user_id) THEN
    RAISE EXCEPTION 'banned from this room';
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (req.community_id, req.user_id, 'member')
  ON CONFLICT DO NOTHING;

  UPDATE public.community_join_requests
  SET status = 'approved', decided_at = NOW()
  WHERE id = p_request_id;
END;
$$;

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

  IF public.community_is_banned(p_community_id, p_user_id) THEN
    RAISE EXCEPTION 'banned from this room';
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (p_community_id, p_user_id, 'member')
  ON CONFLICT DO NOTHING;
END;
$$;

-- Removal without a ban stays available, and now leaves a trace.
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

  INSERT INTO public.community_moderation_log
    (community_id, actor_id, action, target_user_id)
  VALUES (p_community_id, v_caller, 'remove_member', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.community_is_banned(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_ban_member(UUID, UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.community_unban_member(UUID, UUID) TO authenticated;
