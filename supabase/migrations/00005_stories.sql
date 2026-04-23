-- Stories
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type media_type NOT NULL,
  thumbnail_url TEXT,
  duration_seconds FLOAT DEFAULT 5,
  interactive_data JSONB,
  text_overlay JSONB,
  visibility TEXT DEFAULT 'all',
  view_count INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stories_user_expires ON stories(user_id, expires_at DESC);

CREATE TABLE public.story_views (
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

CREATE TABLE public.story_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  cover_url TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.story_highlight_items (
  highlight_id UUID REFERENCES story_highlights(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (highlight_id, story_id)
);

-- RLS
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_highlight_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active stories are viewable"
  ON stories FOR SELECT USING (expires_at > NOW());

CREATE POLICY "Users can create stories"
  ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own stories"
  ON stories FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view story views on own stories"
  ON story_views FOR SELECT USING (
    EXISTS (SELECT 1 FROM stories WHERE id = story_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can record views"
  ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Anyone can view highlights"
  ON story_highlights FOR SELECT USING (true);

CREATE POLICY "Users can manage own highlights"
  ON story_highlights FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view highlight items"
  ON story_highlight_items FOR SELECT USING (true);
