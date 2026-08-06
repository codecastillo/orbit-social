-- Monetization, wired and switched off.
--
-- Daniel's decision: build the schema and the surfaces, integrate no payment
-- gateway, and keep everything free for now. The point is that turning it on
-- later is one integration rather than a redesign.
--
-- "Off" is enforced, not documented. A single config row gates every write
-- that could represent money, so the state of the product is a fact in the
-- database rather than a claim in a comment. Nothing here touches Stripe, no
-- key is read, and no balance is moved.

CREATE TABLE IF NOT EXISTS public.monetization_config (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  -- The gateway boundary. While false, every money-shaped write is refused.
  payments_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- Smallest and largest a tip may be, so the surface has real bounds the
  -- day it switches on rather than a number invented under pressure.
  min_tip_cents INT NOT NULL DEFAULT 100,
  max_tip_cents INT NOT NULL DEFAULT 50000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.monetization_config (id) VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.monetization_config ENABLE ROW LEVEL SECURITY;

-- Readable by everyone so a client can tell whether to show the surfaces at
-- all. Writable by nobody through the API: flipping this is a deliberate act
-- by someone with database access, the same shape as feed_ranking_config.
CREATE POLICY "Monetization config is readable"
  ON public.monetization_config FOR SELECT USING (TRUE);

/** True while payments are switched on. One place asks the question. */
CREATE OR REPLACE FUNCTION public.payments_enabled()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT payments_enabled FROM public.monetization_config), FALSE);
$$;

GRANT EXECUTE ON FUNCTION public.payments_enabled() TO authenticated, anon;

-- Per-creator settings. Exists and is editable while payments are off: a
-- creator can say what they intend to charge before anyone can pay it, and
-- the payout state is a record of how far setup has got, not a promise.
CREATE TABLE IF NOT EXISTS public.creator_monetization (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  tips_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  -- NULL means subscriptions are not offered.
  subscription_price_cents INT
    CHECK (subscription_price_cents IS NULL
           OR subscription_price_cents BETWEEN 100 AND 100000),
  -- Deliberately not 'ready' by default: no payout destination exists until
  -- a gateway is integrated, so nothing may claim it is ready to pay out.
  payout_status TEXT NOT NULL DEFAULT 'none'
    CHECK (payout_status IN ('none', 'pending', 'ready')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.creator_monetization ENABLE ROW LEVEL SECURITY;

-- Anyone can read whether a creator accepts tips, because the button is on
-- their public profile. Only the creator writes their own row.
CREATE POLICY "Creator monetization is publicly readable"
  ON public.creator_monetization FOR SELECT USING (TRUE);
CREATE POLICY "Creators manage their own monetization"
  ON public.creator_monetization FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.tips (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  currency     TEXT NOT NULL DEFAULT 'usd',
  -- The gateway's identifier, once there is a gateway. Null means the row
  -- represents an intent that no processor has ever seen.
  gateway_ref  TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  message      TEXT CHECK (char_length(message) <= 200),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sender_id <> recipient_id)
);

CREATE INDEX IF NOT EXISTS tips_recipient_idx
  ON public.tips (recipient_id, created_at DESC);

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tips are visible to both parties"
  ON public.tips FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Senders create their own tips"
  ON public.tips FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE TABLE IF NOT EXISTS public.creator_subscriptions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  price_cents    INT NOT NULL CHECK (price_cents > 0),
  status         TEXT NOT NULL DEFAULT 'incomplete'
                   CHECK (status IN ('incomplete', 'active', 'past_due', 'canceled')),
  gateway_ref    TEXT,
  current_period_end TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (subscriber_id <> creator_id),
  UNIQUE (subscriber_id, creator_id)
);

ALTER TABLE public.creator_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscriptions are visible to both parties"
  ON public.creator_subscriptions FOR SELECT
  USING (auth.uid() = subscriber_id OR auth.uid() = creator_id);

CREATE POLICY "Subscribers create their own subscriptions"
  ON public.creator_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = subscriber_id);

/**
 * The boundary. Any row that represents money is refused while payments are
 * off, whatever the client believes.
 *
 * A trigger rather than a policy, because a policy that silently matches
 * zero rows reports success and saves nothing, which is the failure mode
 * this project has already been bitten by. This raises.
 */
CREATE OR REPLACE FUNCTION public.reject_when_payments_disabled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.payments_enabled() THEN
    RAISE EXCEPTION 'payments are not enabled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tips_require_payments ON public.tips;
CREATE TRIGGER tips_require_payments
BEFORE INSERT OR UPDATE ON public.tips
FOR EACH ROW EXECUTE FUNCTION public.reject_when_payments_disabled();

DROP TRIGGER IF EXISTS subscriptions_require_payments ON public.creator_subscriptions;
CREATE TRIGGER subscriptions_require_payments
BEFORE INSERT OR UPDATE ON public.creator_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.reject_when_payments_disabled();

-- Subscriber-only post visibility is deliberately NOT added here. Nothing can
-- hold an active subscription while payments are off, so the tier would mean
-- "visible to nobody", and a visibility value that cannot be satisfied is a
-- trap for whoever picks it. It is a small addition to posts' policy the day
-- the gateway is switched on.
