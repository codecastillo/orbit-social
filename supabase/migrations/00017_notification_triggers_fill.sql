-- Phase 1: Fill in missing notification triggers.
-- Existing triggers (00006): follow → notify followee, like → notify post author,
-- reply → notify parent post author. This migration adds:
--   * message → notify recipient(s)
--   * live_started → fan-out to all followers when stream goes active
--   * event_rsvp → notify event creator on new RSVP (mapped to enum 'event_invite')
--   * event_reminder → SQL function called by cron 5 minutes before start_at
-- Triggers for `mention`, `repost`, `story_reaction` are deferred to Phase 5
-- (they require new tables: post_mentions, reposts, story_reactions).

-- ─── messages → notify all OTHER members of the conversation ─────────────
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
   WHERE cm.conversation_id = NEW.conversation_id
     AND cm.user_id <> NEW.sender_id
     AND COALESCE(cm.is_muted, FALSE) = FALSE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_notify ON messages;
CREATE TRIGGER on_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION create_message_notification();

-- ─── live_streams: when status flips to 'live', notify all followers ─────
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
     WHERE f.following_id = NEW.user_id;
  ELSIF (TG_OP = 'INSERT') AND NEW.status = 'live' THEN
    -- Stream created already in 'live' state (rare path)
    INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, data)
    SELECT f.follower_id,
           NEW.user_id,
           'live_started'::notification_type,
           'live_stream',
           NEW.id,
           jsonb_build_object('title', NEW.title, 'playback_id', NEW.mux_playback_id)
      FROM follows f
     WHERE f.following_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_live_started_notify ON live_streams;
CREATE TRIGGER on_live_started_notify
  AFTER INSERT OR UPDATE OF status ON live_streams
  FOR EACH ROW EXECUTE FUNCTION create_live_started_notification();

-- ─── event_rsvps: notify event creator on new RSVP (status='going') ──────
-- We reuse the existing 'event_invite' enum value to mean "someone RSVP'd".
CREATE OR REPLACE FUNCTION create_event_rsvp_notification()
RETURNS TRIGGER AS $$
DECLARE
  host_id UUID;
  event_title TEXT;
BEGIN
  IF NEW.status <> 'going' THEN
    RETURN NEW;
  END IF;
  SELECT creator_id, title INTO host_id, event_title FROM events WHERE id = NEW.event_id;
  IF host_id IS NULL OR host_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, data)
  VALUES (host_id, NEW.user_id, 'event_invite'::notification_type, 'event', NEW.event_id,
          jsonb_build_object('event_title', event_title, 'rsvp_status', NEW.status));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_rsvp_notify ON event_rsvps;
CREATE TRIGGER on_event_rsvp_notify
  AFTER INSERT ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION create_event_rsvp_notification();

-- ─── event_reminders: SQL function called by Vercel Cron every 5 min ─────
-- Sends one-time event_reminder notification 0–15 min before start_at.
-- Idempotent via event_reminders_sent table (created in 00018).
CREATE OR REPLACE FUNCTION notify_due_event_reminders()
RETURNS INTEGER AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  -- Skip silently if helper table hasn't been created yet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'event_reminders_sent'
  ) THEN
    RETURN 0;
  END IF;

  WITH due AS (
    SELECT er.event_id, er.user_id, e.title, e.start_at
      FROM event_rsvps er
      JOIN events e ON e.id = er.event_id
     WHERE er.status = 'going'
       AND e.start_at > NOW()
       AND e.start_at <= NOW() + INTERVAL '15 minutes'
       AND NOT EXISTS (
         SELECT 1 FROM event_reminders_sent ers
          WHERE ers.event_id = er.event_id AND ers.user_id = er.user_id
       )
  ),
  inserted_notifications AS (
    INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id, data)
    SELECT due.user_id,
           NULL,
           'event_reminder'::notification_type,
           'event',
           due.event_id,
           jsonb_build_object('event_title', due.title, 'starts_at', due.start_at)
      FROM due
    RETURNING user_id
  ),
  marked AS (
    INSERT INTO event_reminders_sent (event_id, user_id, sent_at)
    SELECT due.event_id, due.user_id, NOW() FROM due
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO inserted_count FROM inserted_notifications;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── publish_due_scheduled_posts wrapper ─────────────────────────────────
-- The existing 00013 function is named publish_scheduled_posts(). Wrap it
-- under the conventional name used by the cron route.
CREATE OR REPLACE FUNCTION publish_due_scheduled_posts()
RETURNS INTEGER AS $$
BEGIN
  RETURN publish_scheduled_posts();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
