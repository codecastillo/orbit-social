-- Make unread counters update live in the sidebar without a refresh.
-- conversation_members.last_read_at must emit UPDATE events so the messages
-- badge clears the moment a conversation is read; notifications must emit
-- INSERT events so the bell badge bumps the moment a new notification lands.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversation_members'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_members';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

-- Need full row payloads on UPDATE so the change-feed includes the new
-- last_read_at value (otherwise we only get the changed columns by PK).
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
