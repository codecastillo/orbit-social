-- Wave 3: settings and safety depth.

-- Muted words, server-side so they follow the account across devices.
-- Matching happens in client queries and the push fanout, not in RLS.
CREATE TABLE IF NOT EXISTS public.muted_words (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word TEXT NOT NULL CHECK (char_length(word) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, word)
);

ALTER TABLE public.muted_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own muted words" ON public.muted_words;
CREATE POLICY "Users manage own muted words"
  ON public.muted_words FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restrict: a soft limit that the restricted person cannot detect. Their
-- comments stay visible to themselves; everyone else's view filters them
-- client-side, and read receipts are withheld.
CREATE TABLE IF NOT EXISTS public.restricted_users (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restricted_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, restricted_id),
  CHECK (user_id <> restricted_id)
);

ALTER TABLE public.restricted_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own restrictions" ON public.restricted_users;
CREATE POLICY "Users manage own restrictions"
  ON public.restricted_users FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notification granularity: per-type toggles for every notification type the
-- app emits, plus quiet hours (local wall-clock hours, 0-23; the push fanout
-- compares against the user's stored offset).
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS reposts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS live_streams BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS events BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS marketplace BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS communities BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS story_replies BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS new_followers_posts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start SMALLINT CHECK (quiet_hours_start BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS quiet_hours_end SMALLINT CHECK (quiet_hours_end BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS timezone_offset_minutes SMALLINT NOT NULL DEFAULT 0;

-- The per-creator post-notification bell: subscribe to someone's new posts.
CREATE TABLE IF NOT EXISTS public.post_notification_subscriptions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creator_id),
  CHECK (user_id <> creator_id)
);

CREATE INDEX IF NOT EXISTS post_notification_subs_creator_idx
  ON public.post_notification_subscriptions (creator_id);

ALTER TABLE public.post_notification_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own bell subscriptions" ON public.post_notification_subscriptions;
CREATE POLICY "Users manage own bell subscriptions"
  ON public.post_notification_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Sensitive content dial lives on profiles; per-topic see-more/see-less and
-- per-post Not Interested signals feed the For You ranking.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sensitive_content_level TEXT NOT NULL DEFAULT 'standard'
    CHECK (sensitive_content_level IN ('less', 'standard', 'more'));

CREATE TABLE IF NOT EXISTS public.content_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL CHECK (char_length(topic) BETWEEN 1 AND 60),
  preference TEXT NOT NULL CHECK (preference IN ('see_more', 'see_less')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, topic)
);

ALTER TABLE public.content_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own content preferences" ON public.content_preferences;
CREATE POLICY "Users manage own content preferences"
  ON public.content_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.post_feedback (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL DEFAULT 'not_interested' CHECK (feedback IN ('not_interested')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.post_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own post feedback" ON public.post_feedback;
CREATE POLICY "Users manage own post feedback"
  ON public.post_feedback FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Account status appeals. Reports already lets users create rows but not see
-- their own; the status page needs both, plus an appeal thread on actioned
-- reports against the user. Appeals are a separate table so a user can
-- appeal a report they did not file.
DROP POLICY IF EXISTS "Users see reports about themselves once actioned" ON public.reports;
CREATE POLICY "Users see reports about themselves once actioned"
  ON public.reports FOR SELECT
  USING (auth.uid() = reported_user_id AND status = 'actioned');

DROP POLICY IF EXISTS "Users see own filed reports" ON public.reports;
CREATE POLICY "Users see own filed reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE TABLE IF NOT EXISTS public.report_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'upheld', 'reversed')),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (report_id, user_id)
);

ALTER TABLE public.report_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users file and read own appeals" ON public.report_appeals;
CREATE POLICY "Users file and read own appeals"
  ON public.report_appeals FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

DROP POLICY IF EXISTS "Users create own appeals" ON public.report_appeals;
CREATE POLICY "Users create own appeals"
  ON public.report_appeals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins resolve appeals" ON public.report_appeals;
CREATE POLICY "Admins resolve appeals"
  ON public.report_appeals FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );
