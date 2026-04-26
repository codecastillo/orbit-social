-- Phase 5b — Web Push subscriptions table.
-- One row per (user, browser/device) — endpoint is the unique key per device.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT         NOT NULL,
  p256dh      TEXT         NOT NULL,
  auth        TEXT         NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read/insert/delete their own subscriptions.
CREATE POLICY "users see own push subs"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own push subs"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own push subs"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can read all (needed by /api/push/* routes that fan out
-- across users — e.g. the eventual auto-fan-out from notifications).
-- The policy above allows SELECT only with matching auth.uid(); the
-- service role bypasses RLS so no extra policy is required here.
