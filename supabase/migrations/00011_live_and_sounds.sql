-- Sounds (for reels)
CREATE TABLE public.sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  artist TEXT,
  audio_url TEXT NOT NULL,
  duration_seconds FLOAT,
  cover_url TEXT,
  use_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Live streams
CREATE TABLE public.live_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT,
  stream_key TEXT UNIQUE,
  mux_live_stream_id TEXT,
  mux_playback_id TEXT,
  status TEXT DEFAULT 'idle',
  viewer_count INT DEFAULT 0,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE sounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sounds are viewable"
  ON sounds FOR SELECT USING (true);

CREATE POLICY "Live streams are viewable"
  ON live_streams FOR SELECT USING (true);

CREATE POLICY "Users can create live streams"
  ON live_streams FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streams"
  ON live_streams FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own streams"
  ON live_streams FOR DELETE USING (auth.uid() = user_id);
