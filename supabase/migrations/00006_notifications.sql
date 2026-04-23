CREATE TYPE notification_type AS ENUM (
  'like', 'comment', 'follow', 'mention', 'repost', 'quote',
  'message', 'story_reaction', 'live_started',
  'community_invite', 'event_invite', 'event_reminder'
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Notification creation triggers
CREATE OR REPLACE FUNCTION create_follow_notification()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
  VALUES (NEW.following_id, NEW.follower_id, 'follow', 'profile', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_notify
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION create_follow_notification();

CREATE OR REPLACE FUNCTION create_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT user_id INTO post_author FROM posts WHERE id = NEW.post_id;
  IF post_author != NEW.user_id THEN
    INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
    VALUES (post_author, NEW.user_id, 'like', 'post', NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_notify
  AFTER INSERT ON post_likes
  FOR EACH ROW EXECUTE FUNCTION create_like_notification();

CREATE OR REPLACE FUNCTION create_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  parent_author UUID;
BEGIN
  IF NEW.reply_to_id IS NOT NULL THEN
    SELECT user_id INTO parent_author FROM posts WHERE id = NEW.reply_to_id;
    IF parent_author != NEW.user_id THEN
      INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
      VALUES (parent_author, NEW.user_id, 'comment', 'post', NEW.reply_to_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_notify
  AFTER INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION create_comment_notification();
