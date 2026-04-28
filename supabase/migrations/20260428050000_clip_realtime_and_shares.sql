-- Adds share_count tracking on posts + an RPC to bump it, plus publishes
-- posts and post_likes to supabase_realtime so the clip player can react
-- to like/comment/share/reply events in real time.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_post_shares(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.posts
  SET share_count = COALESCE(share_count, 0) + 1
  WHERE id = p_post_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_post_shares(UUID) TO authenticated, anon;

-- Realtime publication: posts + post_likes so the client can listen for
-- count changes and new replies without polling.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'posts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.posts';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_likes'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes';
  END IF;
END $$;

-- DELETE events on post_likes need full row payload so we can react with
-- the post_id (otherwise only the primary key comes through).
ALTER TABLE public.post_likes REPLICA IDENTITY FULL;
