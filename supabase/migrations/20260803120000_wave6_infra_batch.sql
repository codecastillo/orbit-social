-- Wave 6 infra batch: the schema debts queued behind the last three waves.

-- Room slowmode: seconds a member must wait between posts in a community.
-- Enforcement lives in the post insert path client-side for now; the column
-- is the source of truth so a server trigger can harden it later.
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS slowmode_seconds INT NOT NULL DEFAULT 0
    CHECK (slowmode_seconds BETWEEN 0 AND 21600);

-- Moderator pinning. The posts UPDATE policy is owner-only, so moderators
-- pinning someone else's room post silently updated zero rows. Same
-- SECURITY DEFINER pattern as pin_comment, with the role check inside.
CREATE OR REPLACE FUNCTION public.pin_community_post(p_post_id UUID, p_pinned BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
BEGIN
  SELECT community_id INTO v_community_id
  FROM posts WHERE id = p_post_id AND reply_to_id IS NULL;

  IF v_community_id IS NULL THEN
    RAISE EXCEPTION 'not a top-level community post';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = v_community_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'moderator')
  ) THEN
    RAISE EXCEPTION 'only owners and moderators can pin room posts';
  END IF;

  UPDATE posts SET is_pinned = p_pinned WHERE id = p_post_id;
END;
$$;

-- Event co-hosts: co-hosts can edit the event and show on the detail page.
CREATE TABLE IF NOT EXISTS public.event_cohosts (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE public.event_cohosts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cohosts are public" ON public.event_cohosts;
CREATE POLICY "Cohosts are public"
  ON public.event_cohosts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Hosts manage cohosts" ON public.event_cohosts;
CREATE POLICY "Hosts manage cohosts"
  ON public.event_cohosts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND creator_id = auth.uid())
  );

-- Marketplace saved searches (notification fanout comes later; the table is
-- what the UI needs now).
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL DEFAULT '',
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved searches" ON public.saved_searches;
CREATE POLICY "Users manage own saved searches"
  ON public.saved_searches FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Durable live chat: fixes the broadcast-only scrollback gap (a viewer who
-- joins mid-stream sees history) and gives slow mode a durable store.
CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS live_chat_stream_idx
  ON public.live_chat_messages (stream_id, created_at DESC);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Live chat is public" ON public.live_chat_messages;
CREATE POLICY "Live chat is public"
  ON public.live_chat_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users send own chat messages" ON public.live_chat_messages;
CREATE POLICY "Users send own chat messages"
  ON public.live_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Full-text search: generated tsvector columns with GIN indexes so search
-- ranks by relevance instead of scanning ilike patterns.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX IF NOT EXISTS posts_search_idx
  ON public.posts USING GIN (search_vector);

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS listings_search_idx
  ON public.listings USING GIN (search_vector);

-- New-post notification type so the creator bell
-- (post_notification_subscriptions) can fan out.
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'new_post';
