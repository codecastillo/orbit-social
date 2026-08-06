-- profiles.is_verified has existed since the first migration and there has
-- never been a way to ask for it: an admin sets the column by hand or nobody
-- is verified. This is the missing half.
--
-- Verification is free and cannot be bought. Promise 2 says distribution is
-- never for sale, and a paid checkmark is that promise broken in the most
-- visible way available, so nothing here touches payment and the review is a
-- human reading evidence.

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- What the person claims to be, which decides what evidence is convincing.
  category     TEXT NOT NULL CHECK (category IN
                 ('creator', 'business', 'public_figure', 'journalist', 'other')),
  -- Their case in their own words.
  statement    TEXT NOT NULL CHECK (char_length(TRIM(statement)) BETWEEN 20 AND 1000),
  -- Links a reviewer can check: a press page, another verified account, a
  -- company site. Capped because a reviewer reads them all.
  evidence     TEXT[] NOT NULL DEFAULT '{}'
                 CHECK (cardinality(evidence) <= 5),
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected')),
  -- Told to the requester when rejected, because promise 3 says every
  -- decision comes with a reason.
  decision_note TEXT,
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One open request at a time. Without this, a rejected applicant can queue
-- ten more before a reviewer looks at the first.
CREATE UNIQUE INDEX IF NOT EXISTS verification_requests_one_open_idx
  ON public.verification_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS verification_requests_queue_idx
  ON public.verification_requests (status, created_at);

ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "People can read their own verification requests"
  ON public.verification_requests FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin)
  );

CREATE POLICY "People can submit their own verification request"
  ON public.verification_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Withdrawing a pending request is allowed; a decided one is a record and
-- stays. Nobody can edit a request after submitting, including the author,
-- so what a reviewer reads is what was sent.
CREATE POLICY "People can withdraw a pending request"
  ON public.verification_requests FOR DELETE
  USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins decide verification requests"
  ON public.verification_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin));

/**
 * Decides a request and, on approval, sets the badge.
 *
 * One function rather than two writes from the client: approving is two
 * changes to two tables that must not come apart, and profiles.is_verified
 * has no policy letting a user set their own.
 */
CREATE OR REPLACE FUNCTION public.decide_verification_request(
  p_request_id UUID,
  p_approve BOOLEAN,
  p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_target UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_caller AND is_admin
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT user_id INTO v_target
  FROM public.verification_requests
  WHERE id = p_request_id AND status = 'pending';

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'request not found or already decided';
  END IF;

  UPDATE public.verification_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      decision_note = NULLIF(TRIM(p_note), ''),
      reviewed_by = v_caller,
      reviewed_at = NOW()
  WHERE id = p_request_id;

  IF p_approve THEN
    UPDATE public.profiles SET is_verified = TRUE WHERE id = v_target;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_verification_request(UUID, BOOLEAN, TEXT)
  TO authenticated;
