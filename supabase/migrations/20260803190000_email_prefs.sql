-- The daily digest cron emails every user with unread notifications, and
-- there has never been a way to turn it off or an unsubscribe link in the
-- message. That is a compliance problem (CAN-SPAM requires a working
-- opt-out), not just a preference gap.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_digest BOOLEAN NOT NULL DEFAULT true;

-- One-click unsubscribe has to work without a session (the recipient is in
-- their mail client), so the link carries this opaque token instead of a
-- user id. Rotatable, and useless for anything except opting out.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_unsubscribe_token UUID NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_unsubscribe_token_idx
  ON public.profiles (email_unsubscribe_token);

-- Called by the unsubscribe endpoint with the service role; SECURITY DEFINER
-- so an anonymous request can flip exactly one flag and nothing else.
CREATE OR REPLACE FUNCTION public.unsubscribe_by_token(p_token UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
BEGIN
  SELECT id INTO v_user FROM profiles WHERE email_unsubscribe_token = p_token;
  IF v_user IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO notification_preferences (user_id, email_digest)
  VALUES (v_user, FALSE)
  ON CONFLICT (user_id) DO UPDATE SET email_digest = FALSE;

  RETURN TRUE;
END;
$$;
