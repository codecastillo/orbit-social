-- Stage 1 of the ranking system: instrumentation.
--
-- Nothing reads this yet. It ships alone because impressions cannot be
-- reconstructed retroactively: every day without it is training and
-- calibration data the platform never gets back. Until now the only view
-- data was posts.view_count, an anonymous counter with no viewer, so the
-- system could not answer "did this person see this post", which is the
-- denominator every engagement rate needs.

-- One row per (viewer, post, day) rather than an append-only event log:
-- infinite scroll re-renders the same card many times a session, and
-- appending would multiply writes several times over for no analytic gain.
-- Partitioned from day one because adding a partition key to a large table
-- later is a migration nobody wants to run.
CREATE TABLE IF NOT EXISTS public.post_impressions (
  viewer_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id        UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  shown_date     DATE NOT NULL,
  surface        TEXT NOT NULL CHECK (surface IN
                   ('foryou', 'following', 'clips', 'profile', 'hashtag', 'search', 'detail')),
  first_shown_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_shown_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Repeat exposures in the same day, capped so a stuck client cannot
  -- inflate a post's denominator.
  views          SMALLINT NOT NULL DEFAULT 1 CHECK (views >= 0),
  dwell_ms       INTEGER NOT NULL DEFAULT 0 CHECK (dwell_ms >= 0),
  watch_ms       INTEGER NOT NULL DEFAULT 0 CHECK (watch_ms >= 0),
  -- Denominator for completion rate; null for non-video.
  media_ms       INTEGER,
  completions    SMALLINT NOT NULL DEFAULT 0 CHECK (completions >= 0),
  PRIMARY KEY (viewer_id, post_id, shown_date)
) PARTITION BY RANGE (shown_date);

-- Ranking reads by post (value rate), retention deletes by date, both
-- covered here. The PK covers the viewer-side seen-dedupe lookup.
CREATE INDEX IF NOT EXISTS post_impressions_post_date_idx
  ON public.post_impressions (post_id, shown_date);

ALTER TABLE public.post_impressions ENABLE ROW LEVEL SECURITY;

-- Read your own only. Authors never get row access to who saw their posts,
-- only aggregates through the distribution report in stage 3. Deliberately
-- asymmetric with Moments, where named viewers are the product.
DROP POLICY IF EXISTS "Viewers read own impressions" ON public.post_impressions;
CREATE POLICY "Viewers read own impressions"
  ON public.post_impressions FOR SELECT
  USING (auth.uid() = viewer_id);

-- No INSERT or UPDATE policy at all: every write goes through
-- record_impressions() so the caps and the staleness window cannot be
-- bypassed by a hand-rolled client.

-- Partitions: current month plus two ahead. A cron keeps the runway.
DO $$
DECLARE
  m DATE := date_trunc('month', CURRENT_DATE)::date;
  i INT;
BEGIN
  FOR i IN 0..2 LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.post_impressions_%s '
      'PARTITION OF public.post_impressions FOR VALUES FROM (%L) TO (%L)',
      to_char(m + (i || ' months')::interval, 'YYYYMM'),
      (m + (i || ' months')::interval)::date,
      (m + ((i + 1) || ' months')::interval)::date
    );
  END LOOP;
END $$;

-- Signals with no existing home. Likes, bookmarks, comments, reposts,
-- reactions, poll votes and follows already have per-user timestamped rows;
-- those get joined, not duplicated here.
CREATE TABLE IF NOT EXISTS public.post_actions (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  action     TEXT NOT NULL CHECK (action IN
               ('profile_visit', 'link_click', 'share_dm', 'share_external',
                'expand', 'rewatch')),
  surface    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_actions_post_idx
  ON public.post_actions (post_id, action);
CREATE INDEX IF NOT EXISTS post_actions_user_idx
  ON public.post_actions (user_id, created_at DESC);

ALTER TABLE public.post_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own actions" ON public.post_actions;
CREATE POLICY "Users read own actions"
  ON public.post_actions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users record own actions" ON public.post_actions;
CREATE POLICY "Users record own actions"
  ON public.post_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Share-to-DM is the most valuable signal in the ranking weights, and today
-- the share sheets send a bare URL inside message content, which cannot be
-- read back as a signal. This makes it structured.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS shared_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS messages_shared_post_idx
  ON public.messages (shared_post_id) WHERE shared_post_id IS NOT NULL;

-- Batched write path. One statement per flush.
CREATE OR REPLACE FUNCTION public.record_impressions(p_batch JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_count INTEGER;
BEGIN
  IF v_viewer IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO post_impressions AS pi (
    viewer_id, post_id, shown_date, surface,
    first_shown_at, last_shown_at, views, dwell_ms, watch_ms, media_ms, completions
  )
  SELECT
    v_viewer,
    b.post_id,
    -- Server-side date, so a wrong client clock cannot scatter rows across
    -- partitions or backfill yesterday's cohort.
    CURRENT_DATE,
    b.surface,
    now(), now(),
    LEAST(GREATEST(COALESCE(b.views, 1), 0), 50),
    LEAST(GREATEST(COALESCE(b.dwell_ms, 0), 0), 300000),
    LEAST(GREATEST(COALESCE(b.watch_ms, 0), 0), 3600000),
    b.media_ms,
    LEAST(GREATEST(COALESCE(b.completions, 0), 0), 50)
  FROM jsonb_to_recordset(p_batch) AS b(
    post_id UUID,
    surface TEXT,
    views SMALLINT,
    dwell_ms INTEGER,
    watch_ms INTEGER,
    media_ms INTEGER,
    completions SMALLINT
  )
  WHERE b.post_id IS NOT NULL
    AND b.surface IN ('foryou', 'following', 'clips', 'profile', 'hashtag', 'search', 'detail')
  ON CONFLICT (viewer_id, post_id, shown_date) DO UPDATE SET
    last_shown_at = now(),
    views       = LEAST(pi.views + EXCLUDED.views, 200),
    dwell_ms    = LEAST(pi.dwell_ms + EXCLUDED.dwell_ms, 1800000),
    watch_ms    = LEAST(pi.watch_ms + EXCLUDED.watch_ms, 7200000),
    media_ms    = COALESCE(EXCLUDED.media_ms, pi.media_ms),
    completions = LEAST(pi.completions + EXCLUDED.completions, 200);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_impressions(JSONB) TO authenticated;

-- Rolled-up history, so retention can drop raw rows without losing the
-- per-post series the ladder calibrates against. Dormant until volume.
CREATE TABLE IF NOT EXISTS public.post_impression_daily (
  post_id          UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  day              DATE NOT NULL,
  impressions      INTEGER NOT NULL,
  distinct_viewers INTEGER NOT NULL,
  dwell_ms_sum     BIGINT NOT NULL,
  watch_ms_sum     BIGINT NOT NULL,
  completions      INTEGER NOT NULL,
  PRIMARY KEY (post_id, day)
);

ALTER TABLE public.post_impression_daily ENABLE ROW LEVEL SECURITY;
-- No client policies: read through the author-facing report only.

CREATE OR REPLACE FUNCTION public.rollup_post_impressions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day DATE := CURRENT_DATE - 1;
  v_count INTEGER;
BEGIN
  INSERT INTO post_impression_daily (
    post_id, day, impressions, distinct_viewers, dwell_ms_sum, watch_ms_sum, completions
  )
  SELECT post_id, shown_date, SUM(views), COUNT(DISTINCT viewer_id),
         SUM(dwell_ms), SUM(watch_ms), SUM(completions)
  FROM post_impressions
  WHERE shown_date = v_day
  GROUP BY post_id, shown_date
  ON CONFLICT (post_id, day) DO UPDATE SET
    impressions      = EXCLUDED.impressions,
    distinct_viewers = EXCLUDED.distinct_viewers,
    dwell_ms_sum     = EXCLUDED.dwell_ms_sum,
    watch_ms_sum     = EXCLUDED.watch_ms_sum,
    completions      = EXCLUDED.completions;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 90 days of raw rows, per the retention stated in the privacy policy.
-- Drops whole partitions rather than deleting rows.
CREATE OR REPLACE FUNCTION public.prune_impression_partitions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  part RECORD;
  cutoff DATE := date_trunc('month', CURRENT_DATE - INTERVAL '90 days')::date;
BEGIN
  FOR part IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_inherits i ON i.inhrelid = c.oid
    JOIN pg_class p ON p.oid = i.inhparent
    WHERE p.relname = 'post_impressions'
      AND c.relname ~ '^post_impressions_\d{6}$'
      AND to_date(right(c.relname, 6), 'YYYYMM') < cutoff
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I', part.relname);
  END LOOP;
END;
$$;

-- Keeps three months of partitions ahead of today.
CREATE OR REPLACE FUNCTION public.ensure_impression_partitions()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m DATE := date_trunc('month', CURRENT_DATE)::date;
  i INT;
BEGIN
  FOR i IN 0..2 LOOP
    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS public.post_impressions_%s '
      'PARTITION OF public.post_impressions FOR VALUES FROM (%L) TO (%L)',
      to_char(m + (i || ' months')::interval, 'YYYYMM'),
      (m + (i || ' months')::interval)::date,
      (m + ((i + 1) || ' months')::interval)::date
    );
  END LOOP;
END;
$$;

-- Same unschedule-then-schedule idempotency the existing timed jobs use.
SELECT cron.unschedule('impressions-rollup')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'impressions-rollup');
SELECT cron.schedule('impressions-rollup', '30 4 * * *',
  $$SELECT public.rollup_post_impressions()$$);

SELECT cron.unschedule('impressions-retention')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'impressions-retention');
SELECT cron.schedule('impressions-retention', '0 5 * * *',
  $$SELECT public.prune_impression_partitions()$$);

SELECT cron.unschedule('impressions-partition-ahead')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'impressions-partition-ahead');
SELECT cron.schedule('impressions-partition-ahead', '0 6 1 * *',
  $$SELECT public.ensure_impression_partitions()$$);
