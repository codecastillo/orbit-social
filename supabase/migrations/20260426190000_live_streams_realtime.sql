-- Enable Postgres CDC for live_streams so viewers see total_likes / status
-- changes in real time (otherwise the use-stream-hearts CDC subscription
-- silently never fires).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'live_streams'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE live_streams;
  END IF;
END $$;
