-- record_impressions shipped as SECURITY INVOKER in the previous migration,
-- but post_impressions has no INSERT policy on purpose (writes must go through
-- this function so its caps cannot be bypassed by a hand-rolled client). The
-- two together meant the function was refused by the table's own RLS and
-- nothing was ever recorded, silently, because both clients swallow telemetry
-- errors by design.
--
-- SECURITY DEFINER is the pattern the rest of this schema already uses for
-- exactly this shape (increment_clip_loops, pin_comment, fan_out_new_post).
-- It stays safe because the function never trusts the caller for identity:
-- viewer_id is auth.uid(), a null session returns 0, shown_date is set
-- server-side, and every numeric is clamped, so a caller can only ever write
-- their own bounded rows.
CREATE OR REPLACE FUNCTION public.record_impressions(p_batch JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- RLS on posts is not consulted inside a DEFINER function, so the existence
  -- check that visibility would have given for free is made explicit.
  WHERE b.post_id IS NOT NULL
    AND b.surface IN ('foryou', 'following', 'clips', 'profile', 'hashtag', 'search', 'detail')
    AND EXISTS (SELECT 1 FROM posts p WHERE p.id = b.post_id)
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
