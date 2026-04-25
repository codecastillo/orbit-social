-- Phase 1: Cron helper tables.
--   * event_reminders_sent — idempotency for event_reminder cron
--   * email_outbox         — durable queue for emails sent by cron jobs
--                             (digest, etc). Email sender persists rows here
--                             so retries don't double-send.

CREATE TABLE IF NOT EXISTS public.event_reminders_sent (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_reminders_sent_at
  ON public.event_reminders_sent (sent_at);

ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;
-- Read access: only the user the reminder was sent to. Writes only via SECURITY DEFINER funcs.
CREATE POLICY "Users see own reminder receipts"
  ON public.event_reminders_sent FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  template      TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at       TIMESTAMPTZ,
  attempts      INT NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_due
  ON public.email_outbox (scheduled_for)
  WHERE sent_at IS NULL;

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
-- No SELECT policy for end users — admin/service role only.

-- Cleanup: delete reminder receipts older than 30 days (can be moved to cron later)
CREATE OR REPLACE FUNCTION cleanup_old_event_reminders()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM event_reminders_sent WHERE sent_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
