-- Weekly hand-curated Best Loops: editorial is how unknown creators break
-- out while the graph is small. Same admin-write RLS pattern as
-- starter_packs.
CREATE TABLE IF NOT EXISTS public.curated_clips (
  week_start DATE NOT NULL,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (week_start, post_id)
);

CREATE INDEX IF NOT EXISTS curated_clips_week_idx
  ON public.curated_clips (week_start, sort_order);

ALTER TABLE public.curated_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Curated clips are public" ON public.curated_clips;
CREATE POLICY "Curated clips are public"
  ON public.curated_clips FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins curate clips" ON public.curated_clips;
CREATE POLICY "Admins curate clips"
  ON public.curated_clips FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
