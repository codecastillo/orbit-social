-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  website TEXT,
  location TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_creator BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT FALSE,
  follower_count INT DEFAULT 0,
  following_count INT DEFAULT 0,
  post_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'New User'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can create their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile"
  ON profiles FOR DELETE USING (auth.uid() = id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('post-media', 'post-media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('story-media', 'story-media', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('message-media', 'message-media', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('listing-images', 'listing-images', true);

-- Storage policies
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE USING (
    bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Cover images are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'covers');

CREATE POLICY "Users can upload their own cover"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Post media is publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'post-media');

CREATE POLICY "Users can upload post media"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'post-media' AND auth.role() = 'authenticated'
  );

-- Story media policies
CREATE POLICY "Story media is publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'story-media');

CREATE POLICY "Users can upload story media"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'story-media' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can delete own story media"
  ON storage.objects FOR DELETE USING (
    bucket_id = 'story-media' AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Message media policies (private bucket)
CREATE POLICY "Authenticated users can view message media"
  ON storage.objects FOR SELECT USING (
    bucket_id = 'message-media' AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can upload message media"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'message-media' AND auth.role() = 'authenticated'
  );

-- Listing images policies
CREATE POLICY "Listing images are publicly accessible"
  ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');

CREATE POLICY "Users can upload listing images"
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'listing-images' AND auth.role() = 'authenticated'
  );
