-- Add messages and conversations to the supabase_realtime publication so
-- the conversation page receives INSERT/UPDATE events without the user
-- having to refresh.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
  END;
END $$;
