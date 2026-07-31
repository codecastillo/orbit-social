-- Curated starter packs shown at the end of onboarding so new accounts can
-- bootstrap their follow graph in one tap (Bluesky attributes up to 43% of
-- follows to this mechanic). Admins curate packs and their members.
CREATE TABLE IF NOT EXISTS public.starter_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.starter_pack_members (
  pack_id UUID NOT NULL REFERENCES public.starter_packs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (pack_id, user_id)
);

CREATE INDEX IF NOT EXISTS starter_pack_members_pack_idx
  ON public.starter_pack_members (pack_id, sort_order);

ALTER TABLE public.starter_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.starter_pack_members ENABLE ROW LEVEL SECURITY;

-- Anyone (including signed-out crawlers of the onboarding flow) can read
-- active packs; admins can also see inactive ones they are editing.
DROP POLICY IF EXISTS "Active packs are public" ON public.starter_packs;
CREATE POLICY "Active packs are public"
  ON public.starter_packs FOR SELECT
  USING (
    is_active = TRUE
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS "Members of active packs are public" ON public.starter_pack_members;
CREATE POLICY "Members of active packs are public"
  ON public.starter_pack_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM starter_packs sp
      WHERE sp.id = pack_id
        AND (
          sp.is_active = TRUE
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
        )
    )
  );

-- Writes go through the browser client under the admin's own JWT, gated by
-- profiles.is_admin, the same pattern the moderation tables use
-- (00010_moderation.sql). Simpler than a service-role API route and the
-- subquery only reads the caller's own profiles row.
DROP POLICY IF EXISTS "Admins manage packs" ON public.starter_packs;
CREATE POLICY "Admins manage packs"
  ON public.starter_packs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS "Admins manage pack members" ON public.starter_pack_members;
CREATE POLICY "Admins manage pack members"
  ON public.starter_pack_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
