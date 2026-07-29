-- Live gifts become real: persisted rows the streamer can read instead of a
-- client-side animation that vanished. Free reactions, no currency.
CREATE TABLE IF NOT EXISTS public.stream_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gift_type TEXT NOT NULL CHECK (gift_type IN ('star', 'diamond', 'party', 'rocket', 'crown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stream_gifts_stream_idx
  ON public.stream_gifts (stream_id, created_at DESC);

ALTER TABLE public.stream_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Signed-in users send gifts as themselves" ON public.stream_gifts;
CREATE POLICY "Signed-in users send gifts as themselves"
  ON public.stream_gifts FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Anyone can read stream gifts" ON public.stream_gifts;
CREATE POLICY "Anyone can read stream gifts"
  ON public.stream_gifts FOR SELECT
  USING (true);

-- MFA hardening (from the security review of the recovery-code flow):
-- recovery-code hashes must not be readable or deletable by the very
-- aal1 session they defend against. Redemption runs through the
-- service-role client in /api/auth/mfa-recovery, which bypasses RLS.
-- Enrollment inserts stay allowed for the owner, and the settings page's
-- cleanup on unenroll keeps working because that session is at aal2.
DROP POLICY IF EXISTS "Users read own recovery codes" ON public.mfa_recovery_codes;

DROP POLICY IF EXISTS "Users delete own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users delete own recovery codes"
  ON public.mfa_recovery_codes FOR DELETE
  USING (auth.uid() = user_id AND (auth.jwt()->>'aal') = 'aal2');

-- close_friends is only readable by its owner, so the feed and stories
-- checks that ask "am I in this poster's close friends" (.eq friend_id =
-- viewer) always return zero rows and close-friends content hides even from
-- actual close friends. Let the friend see their own membership row.
DROP POLICY IF EXISTS "Friends can see their membership" ON public.close_friends;
CREATE POLICY "Friends can see their membership"
  ON public.close_friends FOR SELECT
  USING (auth.uid() = friend_id);
