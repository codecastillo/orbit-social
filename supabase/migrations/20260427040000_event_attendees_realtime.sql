-- Recompute events.attendee_count from event_rsvps where status = 'going',
-- so the count is always authoritative regardless of how rows are written.
CREATE OR REPLACE FUNCTION public.recompute_event_attendee_count(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.events
  SET attendee_count = (
    SELECT COUNT(*)
    FROM public.event_rsvps
    WHERE event_id = p_event_id AND status = 'going'
  )
  WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.event_rsvps_after_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_event_attendee_count(OLD.event_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_event_attendee_count(NEW.event_id);
    -- if the row moved between events (rare), recompute the other side too
    IF TG_OP = 'UPDATE' AND OLD.event_id IS DISTINCT FROM NEW.event_id THEN
      PERFORM public.recompute_event_attendee_count(OLD.event_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS event_rsvps_recompute ON public.event_rsvps;
CREATE TRIGGER event_rsvps_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.event_rsvps
FOR EACH ROW EXECUTE FUNCTION public.event_rsvps_after_change();

-- Backfill any existing events whose count drifted.
UPDATE public.events e
SET attendee_count = COALESCE((
  SELECT COUNT(*) FROM public.event_rsvps r
  WHERE r.event_id = e.id AND r.status = 'going'
), 0);

-- Realtime: emit row updates for events.attendee_count and rsvp inserts/deletes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.events';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_rsvps'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_rsvps';
  END IF;
END $$;

ALTER TABLE public.event_rsvps REPLICA IDENTITY FULL;

-- Comments on events
CREATE TABLE IF NOT EXISTS public.event_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_comments_event_created
  ON public.event_comments(event_id, created_at DESC);

ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Event comments are viewable" ON public.event_comments;
CREATE POLICY "Event comments are viewable"
  ON public.event_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can post event comments" ON public.event_comments;
CREATE POLICY "Users can post event comments"
  ON public.event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their event comments" ON public.event_comments;
CREATE POLICY "Users can delete their event comments"
  ON public.event_comments FOR DELETE USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'event_comments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_comments';
  END IF;
END $$;
