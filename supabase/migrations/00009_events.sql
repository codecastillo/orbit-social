CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id),
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT FALSE,
  online_url TEXT,
  attendee_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.event_rsvps (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'going',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Events are viewable"
  ON events FOR SELECT USING (true);

CREATE POLICY "Users can create events"
  ON events FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update events"
  ON events FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "RSVPs are viewable"
  ON event_rsvps FOR SELECT USING (true);

CREATE POLICY "Users can RSVP"
  ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update RSVP"
  ON event_rsvps FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove RSVP"
  ON event_rsvps FOR DELETE USING (auth.uid() = user_id);
