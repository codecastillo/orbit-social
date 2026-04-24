-- Profile customization: theme color and avatar border
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme_color TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_border TEXT DEFAULT 'none';

-- Add location column to posts for location tagging
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS location TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_location ON posts(location) WHERE location IS NOT NULL;
