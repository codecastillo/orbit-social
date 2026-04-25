-- Login events table for activity logging
CREATE TABLE public.login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success', -- 'success' or 'failed'
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_events_user ON login_events(user_id, created_at DESC);

ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own login events"
  ON login_events FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own login events"
  ON login_events FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own login events"
  ON login_events FOR UPDATE USING (auth.uid() = user_id);

-- Add is_encrypted to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

-- Add expires_at to blocks and mutes
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE public.mutes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Content moderation flags table
CREATE TABLE public.content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  auto_flagged BOOLEAN DEFAULT TRUE,
  reviewed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_flags_post ON content_flags(post_id);
CREATE INDEX idx_content_flags_reviewed ON content_flags(reviewed) WHERE reviewed = FALSE;

ALTER TABLE content_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own content flags"
  ON content_flags FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert content flags"
  ON content_flags FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update feed function to respect expires_at on blocks and mutes
CREATE OR REPLACE FUNCTION get_feed(p_user_id UUID, p_limit INT DEFAULT 20, p_cursor TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (
  id UUID,
  user_id UUID,
  content TEXT,
  type post_type,
  parent_post_id UUID,
  reply_to_id UUID,
  community_id UUID,
  like_count INT,
  comment_count INT,
  repost_count INT,
  view_count INT,
  bookmark_count INT,
  poll_data JSONB,
  is_pinned BOOLEAN,
  is_hidden BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
  SELECT p.* FROM posts p
  INNER JOIN follows f ON f.following_id = p.user_id
  WHERE f.follower_id = p_user_id
    AND p.reply_to_id IS NULL
    AND p.is_hidden = FALSE
    AND p.created_at < p_cursor
    AND NOT EXISTS (
      SELECT 1 FROM mutes
      WHERE user_id = p_user_id AND muted_id = p.user_id
        AND (expires_at IS NULL OR expires_at > NOW())
    )
    AND NOT EXISTS (
      SELECT 1 FROM blocks
      WHERE blocker_id = p_user_id AND blocked_id = p.user_id
        AND (expires_at IS NULL OR expires_at > NOW())
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;
