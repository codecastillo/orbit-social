-- Server-side link unfurl cache: /api/unfurl scrapes OpenGraph once per URL
-- and every renderer reads the cached row. Written only by the service role.
CREATE TABLE IF NOT EXISTS public.link_previews (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  image_url TEXT,
  site_name TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.link_previews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Link previews are public" ON public.link_previews;
CREATE POLICY "Link previews are public"
  ON public.link_previews FOR SELECT
  USING (true);

-- View counting for post detail opens. SECURITY DEFINER because RLS blocks
-- updating counters on other people's posts.
CREATE OR REPLACE FUNCTION public.increment_post_views(p_post_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE posts SET view_count = view_count + 1 WHERE id = p_post_id;
$$;
