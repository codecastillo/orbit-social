-- Restrict promises, in the help centre: "Restricting someone hides their
-- comments on posts and clips from you, and stops THEM seeing when you have
-- read THEIR messages."
--
-- The first half is a viewer-side hide and is correctly done in the client:
-- it hides their comments from the person who restricted them, and nobody
-- else is affected. Mute is the same shape ("hides that account's posts from
-- YOUR feeds"), which is why mute is also correctly client-side and is not
-- changed here.
--
-- The second half was implemented backwards. getDmSeenAt suppressed the
-- receipt in the wrong direction: if I restricted you, I stopped seeing YOUR
-- read state, while you kept seeing mine. The promise is the opposite, and it
-- cannot be kept in the client at all, because the client that must withhold
-- the receipt belongs to the restricted person and has no reason to.
--
-- This function is the enforcement. It is SECURITY DEFINER because
-- restricted_users is readable only by the person who wrote the restriction
-- ("they are not told anything changed"), so a policy or query running as the
-- restricted viewer could never see the row that applies to them.
--
-- The oracle this creates is deliberately narrow: the answer is a timestamp
-- or null, and null is also what an ordinary receipts-off setting returns, so
-- being restricted stays indistinguishable from the other reasons a receipt
-- does not arrive.

CREATE OR REPLACE FUNCTION public.dm_seen_at(p_conversation_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_other UUID;
  v_seen TIMESTAMPTZ;
  v_is_group BOOLEAN;
BEGIN
  IF v_viewer IS NULL THEN
    RETURN NULL;
  END IF;

  -- SECURITY DEFINER bypasses RLS, so membership is checked by hand rather
  -- than assumed: without this, anyone could read any conversation's state.
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = v_viewer
  ) THEN
    RETURN NULL;
  END IF;

  SELECT is_group INTO v_is_group
  FROM public.conversations WHERE id = p_conversation_id;

  -- Group read receipts are not a feature; only 1:1 has a single "seen".
  IF v_is_group IS NOT FALSE THEN
    RETURN NULL;
  END IF;

  SELECT user_id, last_read_at INTO v_other, v_seen
  FROM public.conversation_members
  WHERE conversation_id = p_conversation_id AND user_id <> v_viewer
  LIMIT 1;

  IF v_other IS NULL OR v_seen IS NULL THEN
    RETURN NULL;
  END IF;

  -- Reciprocal, as promised on /promises: turning your own receipts off also
  -- stops you seeing everyone else's.
  IF NOT COALESCE(
       (SELECT read_receipts_enabled FROM public.profiles WHERE id = v_viewer),
       TRUE)
     OR NOT COALESCE(
       (SELECT read_receipts_enabled FROM public.profiles WHERE id = v_other),
       TRUE) THEN
    RETURN NULL;
  END IF;

  -- The half that was inverted: if the OTHER person restricted the VIEWER,
  -- the viewer does not learn when they read anything.
  IF EXISTS (
    SELECT 1 FROM public.restricted_users
    WHERE user_id = v_other AND restricted_id = v_viewer
  ) THEN
    RETURN NULL;
  END IF;

  -- Kept from the previous behaviour: someone you restricted is someone you
  -- have chosen to see less of, so their read state stays hidden from you
  -- too. Not promised anywhere, but removing it would be a change nobody
  -- asked for.
  IF EXISTS (
    SELECT 1 FROM public.restricted_users
    WHERE user_id = v_viewer AND restricted_id = v_other
  ) THEN
    RETURN NULL;
  END IF;

  RETURN v_seen;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dm_seen_at(UUID) TO authenticated;
