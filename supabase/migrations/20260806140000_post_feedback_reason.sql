-- "Not interested" is a single unexplained bit today: the post disappears and
-- nothing anywhere records why, so it cannot inform anything and the person
-- who tapped it is told nothing about what changed.
--
-- A reason turns one tap into a usable signal and, more importantly, lets the
-- app say what it did. "Fewer posts like this" is a promise nobody can check;
-- "you will see fewer posts tagged #carguy" is one they can.

ALTER TABLE public.post_feedback
  ADD COLUMN IF NOT EXISTS reason TEXT
    CHECK (reason IN ('post', 'author', 'topic', 'format'));

-- Null is the historical value and means the same as 'post': this exact
-- post, no wider conclusion. Backfilling would invent intent nobody gave.
COMMENT ON COLUMN public.post_feedback.reason IS
  'Why the post was dismissed. NULL on rows recorded before reasons existed and means the same as ''post''.';

-- The topic reason writes a see_less row alongside the feedback, and that
-- table keys on (user_id, topic), so a repeat is an update rather than a
-- duplicate. Nothing to change there; noted so the pairing is not a surprise.
