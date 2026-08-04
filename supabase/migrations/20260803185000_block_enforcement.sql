-- Blocking has been a no-op since launch: the blocks table has RLS covering
-- only its own rows, and no policy or query anywhere consumes it. A blocked
-- user still saw your posts, your profile, and could still follow and DM
-- you. This makes blocks mean something, symmetrically and server-side.

-- The reverse direction needs its own index; the PK only covers
-- (blocker_id, blocked_id).
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON public.blocks (blocked_id);
CREATE INDEX IF NOT EXISTS mutes_muted_idx ON public.mutes (muted_id);

-- SECURITY DEFINER because blocks' own SELECT policy is owner-only: a policy
-- subquery running as the viewer could never see "this other person blocked
-- me", which is exactly half of what symmetry requires.
CREATE OR REPLACE FUNCTION public.blocks_between(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND a <> b AND EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

GRANT EXECUTE ON FUNCTION public.blocks_between(UUID, UUID) TO authenticated, anon;

-- Posts disappear in both directions. This restates the private-account
-- clause from the previous migration because the two share one policy; edit
-- them together or one will quietly drop the other's rule.
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (
    NOT is_hidden
    AND NOT public.blocks_between(auth.uid(), user_id)
    AND (
      auth.uid() = user_id
      OR NOT EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = posts.user_id AND p.is_private
      )
      OR EXISTS (
        SELECT 1 FROM follows f
        WHERE f.following_id = posts.user_id AND f.follower_id = auth.uid()
      )
    )
  );

-- A blocked pair cannot follow each other in either direction.
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (
    auth.uid() = follower_id
    AND NOT public.blocks_between(follower_id, following_id)
  );

-- Blocking severs the existing relationship both ways, the way every
-- mainstream platform behaves; leaving stale follows would keep the blocked
-- account in follower counts and starter-pack style surfaces.
CREATE OR REPLACE FUNCTION public.sever_on_block()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);

  DELETE FROM close_friends
  WHERE (user_id = NEW.blocker_id AND friend_id = NEW.blocked_id)
     OR (user_id = NEW.blocked_id AND friend_id = NEW.blocker_id);

  DELETE FROM follow_requests
  WHERE (requester_id = NEW.blocker_id AND target_id = NEW.blocked_id)
     OR (requester_id = NEW.blocked_id AND target_id = NEW.blocker_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sever_on_block ON public.blocks;
CREATE TRIGGER trg_sever_on_block
  AFTER INSERT ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.sever_on_block();

-- Direct messages stop flowing between blocked users. Group rooms are left
-- alone deliberately: silently dropping a member's messages from a shared
-- room would confuse everyone else in it.
CREATE OR REPLACE FUNCTION public.reject_blocked_dm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other UUID;
  v_members INT;
BEGIN
  SELECT count(*) INTO v_members
  FROM conversation_members WHERE conversation_id = NEW.conversation_id;

  IF v_members <> 2 THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_other
  FROM conversation_members
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LIMIT 1;

  IF public.blocks_between(NEW.sender_id, v_other) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reject_blocked_dm ON public.messages;
CREATE TRIGGER trg_reject_blocked_dm
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.reject_blocked_dm();
