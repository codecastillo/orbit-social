-- Privacy enforcement layer.
-- Until now, profiles.is_private / private_followers / private_likes were collected
-- by the settings UI but never consulted by any query or RLS policy. This migration
-- closes those gaps server-side, plus gates the existing notification triggers on
-- the new notification_preferences table so toggling a category off actually stops
-- the notification at the source.

-- ── Helper: does the viewer (auth.uid()) follow the target? ──────────────
-- SECURITY DEFINER so it bypasses the new follows RLS — the helper is what we
-- USE to decide whether the viewer should see private content.
CREATE OR REPLACE FUNCTION public.viewer_follows(target_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid()
      AND following_id = target_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.viewer_follows(UUID) TO authenticated, anon;

-- ── posts: hide private-author posts from non-followers ──────────────────
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
DROP POLICY IF EXISTS "Posts viewable based on privacy" ON public.posts;

CREATE POLICY "Posts viewable based on privacy"
  ON public.posts FOR SELECT
  USING (
    NOT is_hidden
    AND (
      posts.user_id = auth.uid()
      OR NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = posts.user_id AND is_private = TRUE
      )
      OR public.viewer_follows(posts.user_id)
    )
  );

-- ── follows: hide list rows when either endpoint marked private_followers ─
DROP POLICY IF EXISTS "Anyone can view follows" ON public.follows;
DROP POLICY IF EXISTS "Follows viewable based on privacy" ON public.follows;

CREATE POLICY "Follows viewable based on privacy"
  ON public.follows FOR SELECT
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE (p.id = follows.follower_id OR p.id = follows.following_id)
        AND p.private_followers = TRUE
    )
  );

-- ── post_likes: hide which posts a private_likes user has liked ──────────
-- Liker themselves can always see their own row. Likes on a post are still
-- aggregated via the cached posts.like_count column, so post-level counts
-- are unaffected — this only hides the "what user X liked" lookup.
DROP POLICY IF EXISTS "Anyone can view likes" ON public.post_likes;
DROP POLICY IF EXISTS "Likes viewable based on privacy" ON public.post_likes;

CREATE POLICY "Likes viewable based on privacy"
  ON public.post_likes FOR SELECT
  USING (
    user_id = auth.uid()
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = post_likes.user_id AND p.private_likes = TRUE
    )
  );

-- ── Notification triggers: gate on notification_preferences ──────────────
-- Pattern: if a row in notification_preferences exists for the recipient and
-- the relevant column is FALSE, skip the INSERT. If no row exists, the
-- COALESCE(..., TRUE) keeps default behavior unchanged for users who haven't
-- opened the settings page yet.

CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT COALESCE(
    (SELECT follows FROM public.notification_preferences WHERE user_id = NEW.following_id),
    TRUE
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'profile', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT user_id INTO post_author FROM posts WHERE id = NEW.post_id;
  IF post_author IS NULL OR post_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE(
    (SELECT likes FROM public.notification_preferences WHERE user_id = post_author),
    TRUE
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
  VALUES (post_author, NEW.user_id, 'like', 'post', NEW.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  parent_author UUID;
BEGIN
  IF NEW.reply_to_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT user_id INTO parent_author FROM posts WHERE id = NEW.reply_to_id;
  IF parent_author IS NULL OR parent_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE(
    (SELECT comments FROM public.notification_preferences WHERE user_id = parent_author),
    TRUE
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
  VALUES (parent_author, NEW.user_id, 'comment', 'post', NEW.reply_to_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Messages fan out to every conversation member — gate per-row via JOIN.
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_deleted = TRUE THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, data)
  SELECT cm.user_id,
         NEW.sender_id,
         'message'::notification_type,
         'conversation',
         NEW.conversation_id,
         jsonb_build_object('message_id', NEW.id, 'preview', LEFT(COALESCE(NEW.content, ''), 140))
    FROM conversation_members cm
    LEFT JOIN public.notification_preferences np ON np.user_id = cm.user_id
   WHERE cm.conversation_id = NEW.conversation_id
     AND cm.user_id <> NEW.sender_id
     AND COALESCE(cm.is_muted, FALSE) = FALSE
     AND COALESCE(np.messages, TRUE) = TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Live started fans out to followers — same JOIN pattern.
-- (No dedicated "live_started" pref column; ride along with `follows` since
-- only people who follow the streamer see it.)
CREATE OR REPLACE FUNCTION create_live_started_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') AND NEW.status = 'live' AND COALESCE(OLD.status, '') <> 'live' THEN
    INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, data)
    SELECT f.follower_id,
           NEW.user_id,
           'live_started'::notification_type,
           'live_stream',
           NEW.id,
           jsonb_build_object('title', NEW.title, 'playback_id', NEW.mux_playback_id)
      FROM follows f
      LEFT JOIN public.notification_preferences np ON np.user_id = f.follower_id
     WHERE f.following_id = NEW.user_id
       AND COALESCE(np.follows, TRUE) = TRUE;
  ELSIF (TG_OP = 'INSERT') AND NEW.status = 'live' THEN
    INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, data)
    SELECT f.follower_id,
           NEW.user_id,
           'live_started'::notification_type,
           'live_stream',
           NEW.id,
           jsonb_build_object('title', NEW.title, 'playback_id', NEW.mux_playback_id)
      FROM follows f
      LEFT JOIN public.notification_preferences np ON np.user_id = f.follower_id
     WHERE f.following_id = NEW.user_id
       AND COALESCE(np.follows, TRUE) = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
