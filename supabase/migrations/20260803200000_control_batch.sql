-- Controls the audit flagged as missing. Presence needed nothing: last_seen_at,
-- touch_last_seen, and get_visible_last_seen have existed since May with no
-- caller, so that gap is client wiring only.

-- Moments currently vanish for their author too: the stories SELECT policy is
-- expires_at > NOW() with no owner carve-out, so a moment is unrecoverable
-- 24 hours after posting and highlights can only be built from live ones.
-- Authors keep their own archive; everyone else still sees only active ones.
-- Client note: queries for the ACTIVE strip must now filter expires_at
-- themselves, because the policy no longer does it for the owner.
DROP POLICY IF EXISTS "Active stories are viewable" ON public.stories;
DROP POLICY IF EXISTS "Stories are viewable by everyone" ON public.stories;
CREATE POLICY "Active stories, plus your own archive"
  ON public.stories FOR SELECT
  USING (expires_at > NOW() OR auth.uid() = user_id);

-- Who may open a DM with you. Enforcement is below; an existing thread the
-- recipient has replied in always stays open, so this gates first contact
-- rather than silently killing live conversations.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS who_can_message TEXT NOT NULL DEFAULT 'everyone'
    CHECK (who_can_message IN ('everyone', 'following', 'nobody'));

-- Viewer-level like-count hiding, the setting Instagram made standard.
-- Display-only: counts still exist and the author still sees their own.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hide_like_counts BOOLEAN NOT NULL DEFAULT false;

-- Per-post comment controls.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS who_can_comment TEXT NOT NULL DEFAULT 'everyone'
    CHECK (who_can_comment IN ('everyone', 'following', 'nobody'));

CREATE OR REPLACE FUNCTION public.enforce_message_privacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other UUID;
  v_members INT;
  v_rule TEXT;
BEGIN
  SELECT count(*) INTO v_members
  FROM conversation_members WHERE conversation_id = NEW.conversation_id;

  -- Group rooms are governed by membership, not by personal DM rules.
  IF v_members <> 2 THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_other
  FROM conversation_members
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LIMIT 1;

  IF v_other IS NULL THEN
    RETURN NEW;
  END IF;

  -- Once the recipient has spoken in this thread they have accepted it.
  IF EXISTS (
    SELECT 1 FROM messages
    WHERE conversation_id = NEW.conversation_id AND sender_id = v_other
  ) THEN
    RETURN NEW;
  END IF;

  SELECT who_can_message INTO v_rule FROM profiles WHERE id = v_other;

  IF v_rule = 'nobody' THEN
    RAISE EXCEPTION 'message_not_allowed';
  END IF;

  IF v_rule = 'following' AND NOT EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = v_other AND following_id = NEW.sender_id
  ) THEN
    RAISE EXCEPTION 'message_not_allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_message_privacy ON public.messages;
CREATE TRIGGER trg_enforce_message_privacy
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_message_privacy();

CREATE OR REPLACE FUNCTION public.enforce_comment_privacy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author UUID;
  v_rule TEXT;
BEGIN
  SELECT user_id, who_can_comment INTO v_author, v_rule
  FROM posts WHERE id = NEW.reply_to_id;

  -- The author always keeps their own thread open to themselves.
  IF v_author IS NULL OR v_author = NEW.user_id OR v_rule = 'everyone' THEN
    RETURN NEW;
  END IF;

  IF v_rule = 'nobody' THEN
    RAISE EXCEPTION 'comments_closed';
  END IF;

  IF v_rule = 'following' AND NOT EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = v_author AND following_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'comments_closed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_comment_privacy ON public.posts;
CREATE TRIGGER trg_enforce_comment_privacy
  BEFORE INSERT ON public.posts
  FOR EACH ROW
  WHEN (NEW.reply_to_id IS NOT NULL)
  EXECUTE FUNCTION public.enforce_comment_privacy();

-- Removing a follower needs SECURITY DEFINER: the follows DELETE policy is
-- auth.uid() = follower_id, so the person being followed cannot delete the
-- row today. Standard private-account hygiene.
CREATE OR REPLACE FUNCTION public.remove_follower(p_follower UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM follows
  WHERE follower_id = p_follower AND following_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_follower(UUID) TO authenticated;
