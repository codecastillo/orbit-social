-- Daily moment prompt, BeReal-style: once a day at a random hour, everyone
-- gets a "time for a moment" nudge. Hour-granularity randomness for v1: a
-- morning job picks today's hour, an hourly job fires when it arrives.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'moment_prompt';

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS moment_prompts BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.moment_prompt_state (
  day DATE PRIMARY KEY,
  fire_hour INT NOT NULL CHECK (fire_hour BETWEEN 0 AND 23),
  fired BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.moment_prompt_state ENABLE ROW LEVEL SECURITY;
-- Cron-only table: no client policies at all.

-- Picks today's hour: 15:00-02:00 UTC covers waking hours for the current
-- (US) user base; revisit when the audience globalizes.
CREATE OR REPLACE FUNCTION public.schedule_moment_prompt()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO moment_prompt_state (day, fire_hour)
  VALUES (CURRENT_DATE, (15 + floor(random() * 12)::int) % 24)
  ON CONFLICT (day) DO NOTHING;
$$;

CREATE OR REPLACE FUNCTION public.fire_moment_prompt()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  UPDATE moment_prompt_state
  SET fired = true
  WHERE day = CURRENT_DATE
    AND fired = false
    AND fire_hour = date_part('hour', now())::int;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  INSERT INTO notifications (user_id, type, entity_type)
  SELECT p.id, 'moment_prompt'::notification_type, 'moment'
  FROM profiles p
  LEFT JOIN notification_preferences np ON np.user_id = p.id
  WHERE COALESCE(np.moment_prompts, true);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

SELECT cron.schedule(
  'moment-prompt-pick',
  '5 8 * * *',
  $$SELECT public.schedule_moment_prompt()$$
);

SELECT cron.schedule(
  'moment-prompt-fire',
  '0 * * * *',
  $$SELECT public.fire_moment_prompt()$$
);
