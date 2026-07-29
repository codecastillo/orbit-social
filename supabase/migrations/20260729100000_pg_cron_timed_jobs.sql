-- Timed jobs move into the database. Vercel Hobby caps cron at daily, so
-- scheduled posts published up to 24 hours late and event reminders (a
-- 15-minute window) almost never fired. pg_cron runs them on time; the
-- existing Vercel daily crons remain as a harmless backstop.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Re-runnable: drop any prior schedules for these names first.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN ('publish-scheduled-posts', 'event-reminders', 'cleanup-stories');

SELECT cron.schedule(
  'publish-scheduled-posts',
  '*/5 * * * *',
  $$SELECT public.publish_due_scheduled_posts()$$
);

SELECT cron.schedule(
  'event-reminders',
  '*/5 * * * *',
  $$SELECT public.notify_due_event_reminders()$$
);

SELECT cron.schedule(
  'cleanup-stories',
  '17 * * * *',
  $$DELETE FROM public.stories WHERE expires_at < now()$$
);
