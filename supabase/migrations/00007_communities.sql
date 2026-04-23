CREATE TABLE public.communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  member_count INT DEFAULT 0,
  created_by UUID NOT NULL REFERENCES profiles(id),
  rules JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.community_members (
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (community_id, user_id)
);

-- Add FK to posts
ALTER TABLE posts ADD CONSTRAINT posts_community_fk
  FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public communities are viewable"
  ON communities FOR SELECT USING (NOT is_private OR EXISTS (
    SELECT 1 FROM community_members WHERE community_id = id AND user_id = auth.uid()
  ));

CREATE POLICY "Authenticated users can create communities"
  ON communities FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update communities"
  ON communities FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Members can view membership"
  ON community_members FOR SELECT USING (true);

CREATE POLICY "Users can join communities"
  ON community_members FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave communities"
  ON community_members FOR DELETE USING (auth.uid() = user_id);

-- Member count trigger
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_community_member_change
  AFTER INSERT OR DELETE ON community_members
  FOR EACH ROW EXECUTE FUNCTION update_community_member_count();
