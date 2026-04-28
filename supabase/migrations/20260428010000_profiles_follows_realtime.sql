-- Stream profile.{follower_count, following_count} updates and follows
-- inserts/deletes so the profile page can update orbit/mutuals counts +
-- the follow-list dialog without a refresh.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'follows'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.follows';
  END IF;
END $$;

-- Need full row payloads on follows DELETE so we can react with both
-- follower_id and following_id for cache invalidation.
ALTER TABLE public.follows REPLICA IDENTITY FULL;
