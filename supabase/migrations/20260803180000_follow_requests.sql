-- Private accounts have been private in name only: profiles.is_private gated
-- some web rendering, but following was an unconditional insert, so anyone
-- who tapped Follow got instant access to everything, and mobile ignored the
-- flag entirely. This adds the request gate the setting always implied.

CREATE TABLE IF NOT EXISTS public.follow_requests (
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (requester_id, target_id),
  CHECK (requester_id <> target_id)
);

CREATE INDEX IF NOT EXISTS follow_requests_target_idx
  ON public.follow_requests (target_id, created_at DESC);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

-- Both sides of a pending request can see it: the requester to show
-- "Requested", the target to work their inbox.
DROP POLICY IF EXISTS "Requester and target see the request" ON public.follow_requests;
CREATE POLICY "Requester and target see the request"
  ON public.follow_requests FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Only ever against a private account: a request to a public account would
-- be a follow, and allowing both would let a client stall a real follow.
DROP POLICY IF EXISTS "Users request their own follows" ON public.follow_requests;
CREATE POLICY "Users request their own follows"
  ON public.follow_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = target_id AND is_private = TRUE
    )
  );

-- The requester cancels, the target denies; both are a plain delete.
DROP POLICY IF EXISTS "Either side clears the request" ON public.follow_requests;
CREATE POLICY "Either side clears the request"
  ON public.follow_requests FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- A private account's posts are for its followers. Logged-out readers and
-- non-followers see nothing, which is what the toggle has always promised.
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT
  USING (
    NOT is_hidden
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

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'follow_request';

-- Approving needs SECURITY DEFINER: the follows INSERT policy requires
-- auth.uid() = follower_id, so the target approving cannot write the row
-- the requester is owed.
CREATE OR REPLACE FUNCTION public.approve_follow_request(p_requester UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target UUID := auth.uid();
BEGIN
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM follow_requests
  WHERE requester_id = p_requester AND target_id = v_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no pending request';
  END IF;

  INSERT INTO follows (follower_id, following_id)
  VALUES (p_requester, v_target)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_follow_request(UUID) TO authenticated;

-- The target hears about a request the same way they hear about a follow.
CREATE OR REPLACE FUNCTION public.create_follow_request_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT COALESCE(
    (SELECT follows FROM notification_preferences WHERE user_id = NEW.target_id),
    TRUE
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
  VALUES (NEW.target_id, NEW.requester_id, 'follow_request', 'profile', NEW.requester_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_request_notification ON public.follow_requests;
CREATE TRIGGER trg_follow_request_notification
  AFTER INSERT ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.create_follow_request_notification();
