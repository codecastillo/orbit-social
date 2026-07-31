-- Weekly cap on ambient push notifications (likes, reposts, live alerts and
-- similar). Person-to-person pushes are never budgeted. One row per user per
-- ISO week, written by /api/push/notify.
CREATE TABLE IF NOT EXISTS public.push_budget (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  ambient_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, week_start)
);

-- Only the push delivery route touches this table, via the service-role
-- client which bypasses RLS. Enabling RLS with no policies locks out every
-- other role.
ALTER TABLE public.push_budget ENABLE ROW LEVEL SECURITY;
