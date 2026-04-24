-- Post Reactions table
CREATE TABLE public.post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('love', 'fire', 'laugh', 'sad', 'wow', 'angry')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

CREATE INDEX idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX idx_post_reactions_user ON post_reactions(user_id);

-- RLS for post_reactions
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reactions"
  ON post_reactions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can add reactions"
  ON post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reactions"
  ON post_reactions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
  ON post_reactions FOR DELETE USING (auth.uid() = user_id);

-- Post boosting: add boosted_until to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS boosted_until TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX idx_posts_boosted ON posts(boosted_until) WHERE boosted_until IS NOT NULL;
