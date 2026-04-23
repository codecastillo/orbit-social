CREATE TYPE listing_status AS ENUM ('active', 'sold', 'removed', 'draft');

CREATE TABLE public.listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  category TEXT NOT NULL,
  condition TEXT,
  location TEXT,
  status listing_status DEFAULT 'active',
  view_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.listing_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

-- RLS
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active listings are viewable"
  ON listings FOR SELECT USING (status = 'active' OR auth.uid() = seller_id);

CREATE POLICY "Users can create listings"
  ON listings FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Users can update own listings"
  ON listings FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Users can delete own listings"
  ON listings FOR DELETE USING (auth.uid() = seller_id);

CREATE POLICY "Listing images are viewable"
  ON listing_images FOR SELECT USING (true);

CREATE POLICY "Users can upload listing images"
  ON listing_images FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM listings WHERE id = listing_id AND seller_id = auth.uid())
  );
