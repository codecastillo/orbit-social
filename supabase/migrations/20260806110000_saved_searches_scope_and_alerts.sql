-- saved_searches was built for Marketplace and reads as if it were general:
-- getSavedSearches(userId) returns every row a user owns with no notion of
-- what the search was for. Saving a post search into the same table would
-- make it appear in the Marketplace filter bar, so scope comes first.
--
-- Existing rows are all Marketplace, which is why that is the default: no
-- backfill, and the Marketplace query keeps returning exactly what it did
-- once it filters on the new column.

ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'marketplace'
    CHECK (scope IN ('marketplace', 'posts'));

-- Optional name. Without one the query text is the label, which is fine for
-- "from:@dan has:image" and poor for a long one.
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS label TEXT CHECK (char_length(label) <= 60);

-- Alerts are opt-in per search. A saved search that quietly starts sending
-- notifications is a subscription nobody asked for.
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS alerts_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- The watermark the alert job compares against. Seeded to the row's creation
-- time so enabling alerts never floods someone with everything that already
-- matched before they asked.
ALTER TABLE public.saved_searches
  ADD COLUMN IF NOT EXISTS last_alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS saved_searches_alerts_idx
  ON public.saved_searches (alerts_enabled, scope)
  WHERE alerts_enabled;

-- A new notification type for "your saved search found something".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'notification_type'::regtype
      AND enumlabel = 'saved_search'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'saved_search';
  END IF;
END $$;
