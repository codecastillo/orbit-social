-- Native devices register Expo push tokens; a different transport from the
-- browser push_subscriptions rows. One row per device token, reassigned to
-- whichever user is signed in on that device.
CREATE TABLE IF NOT EXISTS public.expo_push_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expo_push_tokens_user_idx
  ON public.expo_push_tokens (user_id);

ALTER TABLE public.expo_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own push tokens" ON public.expo_push_tokens;
CREATE POLICY "Users insert own push tokens"
  ON public.expo_push_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- A device that switches accounts must be able to take over its own token
-- row (tokens are unguessable); the WITH CHECK still forces assignment to
-- the caller, never to a third party.
DROP POLICY IF EXISTS "Devices reassign their token" ON public.expo_push_tokens;
CREATE POLICY "Devices reassign their token"
  ON public.expo_push_tokens FOR UPDATE
  USING (true)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own push tokens" ON public.expo_push_tokens;
CREATE POLICY "Users delete own push tokens"
  ON public.expo_push_tokens FOR DELETE
  USING (auth.uid() = user_id);
