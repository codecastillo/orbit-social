-- Structured @mention storage. Lets us cheaply query "posts that tagged
-- user X" for the profile Tagged tab, and unblocks the mention-notification
-- trigger flagged as deferred in 00017_notification_triggers_fill.sql.
--
-- Population happens automatically via a SECURITY DEFINER trigger on the
-- posts table that parses @handles out of post.content on every insert/update
-- and reconciles the per-post rows.

CREATE TABLE IF NOT EXISTS public.post_mentions (
  post_id     UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_mentions_user_idx
  ON public.post_mentions(user_id, created_at DESC);

ALTER TABLE public.post_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mentions readable by everyone" ON public.post_mentions;
CREATE POLICY "mentions readable by everyone"
  ON public.post_mentions FOR SELECT USING (true);

-- Writes happen via the trigger below (SECURITY DEFINER), so we
-- intentionally don't expose INSERT/UPDATE/DELETE to clients.

CREATE OR REPLACE FUNCTION public.sync_post_mentions()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  handle TEXT;
  matched_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.post_mentions WHERE post_id = OLD.id;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.post_mentions WHERE post_id = NEW.id;
  END IF;

  IF NEW.content IS NOT NULL THEN
    FOR handle IN
      SELECT DISTINCT lower(m[1])
      FROM regexp_matches(NEW.content, '@([A-Za-z0-9_]{1,30})', 'g') AS m
    LOOP
      SELECT id INTO matched_id
      FROM public.profiles
      WHERE lower(username) = handle
      LIMIT 1;
      IF matched_id IS NOT NULL AND matched_id <> NEW.user_id THEN
        INSERT INTO public.post_mentions (post_id, user_id)
        VALUES (NEW.id, matched_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS posts_sync_mentions ON public.posts;
CREATE TRIGGER posts_sync_mentions
  AFTER INSERT OR UPDATE OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_mentions();

-- One-shot backfill for posts that already exist.
INSERT INTO public.post_mentions (post_id, user_id)
SELECT p.id, pr.id
FROM public.posts p
CROSS JOIN LATERAL regexp_matches(p.content, '@([A-Za-z0-9_]{1,30})', 'g') AS m
JOIN public.profiles pr ON lower(pr.username) = lower(m[1])
WHERE p.content IS NOT NULL AND pr.id <> p.user_id
ON CONFLICT DO NOTHING;
