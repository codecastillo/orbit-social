-- Performance: nine composite indexes that the audit flagged as
-- highest-impact. Every feed / clips / community / event / comment / live
-- load currently does an avoidable sort or seq scan.
--
-- Each is CREATE INDEX IF NOT EXISTS so the migration is idempotent.
-- Wrap in their own statements so a single failure doesn't roll back the
-- rest.

-- (user_id, created_at DESC) — Following-tab feed picks 200+ user_ids and
-- orders by created_at. Existing single-col idx_posts_user_id forces a
-- separate sort.
CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at
  ON public.posts (user_id, created_at DESC);

-- Comment threads: getPostComments / getCommentReplies filter by
-- reply_to_id and order by created_at. The existing partial index isn't
-- sorted, so reads do an in-memory sort per thread.
CREATE INDEX IF NOT EXISTS idx_posts_reply_to_created_at
  ON public.posts (reply_to_id, created_at DESC)
  WHERE reply_to_id IS NOT NULL;

-- Community feeds: getCommunityPosts orders by created_at DESC scoped
-- to a community_id. No composite today.
CREATE INDEX IF NOT EXISTS idx_posts_community_id_created_at
  ON public.posts (community_id, created_at DESC)
  WHERE community_id IS NOT NULL;

-- Reverse-direction interaction lookups: card lists call
-- checkUserInteractions(userId, [postIds]) which probes by post_id; the
-- composite PK on (user_id, post_id) doesn't help that direction.
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id
  ON public.post_likes (post_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_post_id
  ON public.bookmarks (post_id);

-- Close-friends visibility: feed filter does
-- in("user_id", posterIds) AND eq("friend_id", viewerId). No index covers
-- this lookup direction today.
CREATE INDEX IF NOT EXISTS idx_close_friends_friend_id
  ON public.close_friends (friend_id, user_id);

-- "My communities" + membership checks key off (user_id, community_id);
-- the PK is in the opposite direction.
CREATE INDEX IF NOT EXISTS idx_community_members_user_id
  ON public.community_members (user_id, community_id);

-- Live homepage filters status='live' and orders by started_at; no
-- coverage today, full table scan as the streams table grows.
CREATE INDEX IF NOT EXISTS idx_live_streams_status_started
  ON public.live_streams (status, started_at DESC)
  WHERE status = 'live';

-- Events feed orders by start_at and gte(start_at, today); no plain
-- index on that column.
CREATE INDEX IF NOT EXISTS idx_events_start_at
  ON public.events (start_at ASC);
