-- Phase 3.2 — Trigram indexes for ILIKE-based search acceleration
-- Existing search functions use ILIKE '%term%' patterns which can't use
-- standard B-tree indexes. pg_trgm + GIN gives us an index that accelerates
-- those queries directly with no code changes required.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── profiles search (searchUsers in social.ts) ──────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_username_trgm
  ON public.profiles USING gin (username gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON public.profiles USING gin (display_name gin_trgm_ops);

-- ── posts search (searchPosts in social.ts) ────────────────────
-- Partial index excludes hidden posts since the query always filters them out.
CREATE INDEX IF NOT EXISTS idx_posts_content_trgm
  ON public.posts USING gin (content gin_trgm_ops)
  WHERE is_hidden = false;

-- ── listings search (searchListings in marketplace.ts) ─────────
-- Partial index restricted to active listings.
CREATE INDEX IF NOT EXISTS idx_listings_title_trgm
  ON public.listings USING gin (title gin_trgm_ops)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_description_trgm
  ON public.listings USING gin (description gin_trgm_ops)
  WHERE status = 'active';

-- ── location-based nearby user search (getNearbyUsers in social.ts) ──
CREATE INDEX IF NOT EXISTS idx_profiles_location_trgm
  ON public.profiles USING gin (location gin_trgm_ops)
  WHERE location IS NOT NULL;
