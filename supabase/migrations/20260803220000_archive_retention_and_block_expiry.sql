-- Two defects found while fact-checking the help center against the code.

-- 1. The moment archive shipped against a cleanup job that hard-deletes
-- expired rows every hour, so an author's archive was empty within about an
-- hour of a moment expiring. Expiry is what makes a moment ephemeral TO
-- VIEWERS, and the stories policy already enforces that (non-owners see only
-- unexpired rows). Deletion is a separate concern: retention. Keep the row
-- for the author for 30 days, then delete it for real.
SELECT cron.unschedule('cleanup-stories')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-stories');

SELECT cron.schedule(
  'cleanup-stories',
  '17 * * * *',
  $$DELETE FROM public.stories WHERE expires_at < now() - interval '30 days'$$
);

-- 2. blocks.expires_at has existed since the security wave and the block
-- dialog offers durations, but nothing ever read the column, so every
-- "24 hour" block was permanent. Honor it: an expired block stops applying
-- everywhere blocks_between gates (posts visibility, follows, direct
-- messages).
CREATE OR REPLACE FUNCTION public.blocks_between(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND a <> b AND EXISTS (
    SELECT 1 FROM blocks
    WHERE ((blocker_id = a AND blocked_id = b)
        OR (blocker_id = b AND blocked_id = a))
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Expired rows are dead weight and make the block list lie about who is
-- blocked, so sweep them alongside the other timed jobs.
SELECT cron.schedule(
  'cleanup-expired-blocks',
  '23 * * * *',
  $$DELETE FROM public.blocks WHERE expires_at IS NOT NULL AND expires_at < now()$$
);
