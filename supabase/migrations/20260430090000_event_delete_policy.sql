-- Hosts couldn't actually remove their own events because no DELETE
-- policy existed on `events` (only INSERT/UPDATE). Add the missing
-- creator-scoped delete policy. The FK CASCADE on event_rsvps + event
-- comments will tear those rows down with it.
CREATE POLICY "Creators can delete events"
  ON public.events FOR DELETE USING (auth.uid() = creator_id);
