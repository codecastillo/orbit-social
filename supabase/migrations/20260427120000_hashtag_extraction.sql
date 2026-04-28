-- Hashtag extraction: scan post.content for #words and maintain
-- `hashtags` + `post_hashtags`. Without this trigger, the Discover page's
-- "trending" rails always returned empty because nothing populated the
-- hashtags table.

CREATE OR REPLACE FUNCTION public.extract_post_hashtags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tag TEXT;
  tag_id UUID;
  matches TEXT[];
BEGIN
  -- On UPDATE, drop existing tag links so we re-extract from new content.
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.post_hashtags WHERE post_id = NEW.id;
  END IF;

  IF NEW.content IS NULL THEN
    RETURN NEW;
  END IF;

  -- Match #word_or_digit (3-50 chars), case-insensitive, distinct.
  SELECT ARRAY(
    SELECT DISTINCT lower(m[1])
    FROM regexp_matches(NEW.content, '(?:^|\s)#([a-zA-Z0-9_]{2,50})', 'g') m
  ) INTO matches;

  IF matches IS NULL OR array_length(matches, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH tag IN ARRAY matches LOOP
    -- Upsert the hashtag and bump its post_count.
    INSERT INTO public.hashtags (name, post_count)
    VALUES (tag, 1)
    ON CONFLICT (name) DO UPDATE
      SET post_count = public.hashtags.post_count + 1
    RETURNING id INTO tag_id;

    INSERT INTO public.post_hashtags (post_id, hashtag_id)
    VALUES (NEW.id, tag_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_extract_hashtags ON public.posts;
CREATE TRIGGER posts_extract_hashtags
AFTER INSERT OR UPDATE OF content ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.extract_post_hashtags();

-- When a post is deleted, decrement counts for any tags it held.
CREATE OR REPLACE FUNCTION public.decrement_hashtag_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.hashtags h
  SET post_count = GREATEST(post_count - 1, 0)
  FROM public.post_hashtags ph
  WHERE ph.post_id = OLD.id AND ph.hashtag_id = h.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS posts_decrement_hashtags ON public.posts;
CREATE TRIGGER posts_decrement_hashtags
BEFORE DELETE ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.decrement_hashtag_counts();

-- Backfill existing posts in one pass so the page has data immediately.
DO $$
DECLARE
  r RECORD;
  tag TEXT;
  tag_id UUID;
  matches TEXT[];
BEGIN
  -- Reset counts; we'll recompute from scratch.
  UPDATE public.hashtags SET post_count = 0;
  DELETE FROM public.post_hashtags;

  FOR r IN
    SELECT id, content FROM public.posts WHERE content IS NOT NULL
  LOOP
    SELECT ARRAY(
      SELECT DISTINCT lower(m[1])
      FROM regexp_matches(r.content, '(?:^|\s)#([a-zA-Z0-9_]{2,50})', 'g') m
    ) INTO matches;

    IF matches IS NULL OR array_length(matches, 1) IS NULL THEN
      CONTINUE;
    END IF;

    FOREACH tag IN ARRAY matches LOOP
      INSERT INTO public.hashtags (name, post_count)
      VALUES (tag, 1)
      ON CONFLICT (name) DO UPDATE
        SET post_count = public.hashtags.post_count + 1
      RETURNING id INTO tag_id;

      INSERT INTO public.post_hashtags (post_id, hashtag_id)
      VALUES (r.id, tag_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
