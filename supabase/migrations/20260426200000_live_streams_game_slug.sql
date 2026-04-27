ALTER TABLE live_streams ADD COLUMN IF NOT EXISTS game_slug TEXT;

CREATE INDEX IF NOT EXISTS live_streams_game_slug_status_idx
  ON live_streams (game_slug, status) WHERE status = 'live';
