-- Follows
CREATE TABLE public.follows (
  follower_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX idx_follows_following ON follows(following_id);

-- Blocks
CREATE TABLE public.blocks (
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Mutes
CREATE TABLE public.mutes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  muted_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, muted_id)
);

-- Close friends
CREATE TABLE public.close_friends (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- RLS
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE close_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows"
  ON follows FOR SELECT USING (true);

CREATE POLICY "Users can follow others"
  ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON follows FOR DELETE USING (auth.uid() = follower_id);

CREATE POLICY "Users can view own blocks"
  ON blocks FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
  ON blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
  ON blocks FOR DELETE USING (auth.uid() = blocker_id);

CREATE POLICY "Users can view own mutes"
  ON mutes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can mute others"
  ON mutes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unmute"
  ON mutes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own close friends"
  ON close_friends FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage close friends"
  ON close_friends FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove close friends"
  ON close_friends FOR DELETE USING (auth.uid() = user_id);

-- Follow count triggers
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_change
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Feed function (chronological following feed)
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
      SELECT 1 FROM mutes WHERE user_id = p_user_id AND muted_id = p.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM blocks WHERE blocker_id = p_user_id AND blocked_id = p.user_id
    )
  ORDER BY p.created_at DESC
  LIMIT p_limit;
$$ LANGUAGE sql SECURITY DEFINER;
