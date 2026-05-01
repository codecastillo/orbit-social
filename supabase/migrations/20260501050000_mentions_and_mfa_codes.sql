-- ── Mentions notification trigger ───────────────────────────────────────
-- Fires when a row lands in post_mentions (which is itself populated by the
-- sync_post_mentions trigger on the posts table). Gates on the recipient's
-- notification_preferences.mentions flag so the toggle in /settings/notifications
-- finally has a server-side effect.

CREATE OR REPLACE FUNCTION create_mention_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  IF NOT COALESCE(
    (SELECT mentions FROM public.notification_preferences WHERE user_id = NEW.user_id),
    TRUE
  ) THEN
    RETURN NEW;
  END IF;
  SELECT user_id INTO post_author FROM posts WHERE id = NEW.post_id;
  IF post_author IS NULL OR post_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
  VALUES (NEW.user_id, post_author, 'mention', 'post', NEW.post_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_mention_notify ON public.post_mentions;
CREATE TRIGGER on_mention_notify
  AFTER INSERT ON public.post_mentions
  FOR EACH ROW EXECUTE FUNCTION create_mention_notification();

-- ── MFA recovery codes ──────────────────────────────────────────────────
-- The /settings/security 2FA flow generated 8 codes and showed them once,
-- never persisting them. If the user lost their phone they had no way to
-- recover. Store SHA-256 hashes (never the plaintext) so the verify path
-- can match a presented code without us ever knowing it.

CREATE TABLE IF NOT EXISTS public.mfa_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, code_hash)
);

CREATE INDEX IF NOT EXISTS mfa_recovery_codes_user_idx
  ON public.mfa_recovery_codes(user_id) WHERE used_at IS NULL;

ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users read own recovery codes"
  ON public.mfa_recovery_codes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users insert own recovery codes"
  ON public.mfa_recovery_codes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users delete own recovery codes"
  ON public.mfa_recovery_codes FOR DELETE USING (auth.uid() = user_id);

-- ── last_seen_at + hide_activity wiring ─────────────────────────────────
-- Until now, hide_activity persisted in /settings/privacy but had no
-- consumer because no last-seen / typing-indicator surface existed. Add
-- the column so any future surface can read it through the gated helper
-- (touch_last_seen / get_visible_last_seen) and the toggle has a real
-- server-side effect.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS profiles_last_seen_idx
  ON public.profiles(last_seen_at DESC) WHERE last_seen_at IS NOT NULL;

-- Caller-only: write your own last_seen. SECURITY DEFINER lets us bump
-- without exposing a column-level UPDATE RLS rule.
CREATE OR REPLACE FUNCTION public.touch_last_seen()
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles SET last_seen_at = NOW() WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.touch_last_seen() TO authenticated;

-- Reader: returns NULL for users who turned hide_activity on, otherwise
-- the actual timestamp. Bypasses RLS for the column read but applies the
-- privacy flag explicitly.
CREATE OR REPLACE FUNCTION public.get_visible_last_seen(target_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(hide_activity, FALSE) = TRUE AND id <> auth.uid() THEN NULL
    ELSE last_seen_at
  END
  FROM public.profiles
  WHERE id = target_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_visible_last_seen(UUID) TO authenticated, anon;
