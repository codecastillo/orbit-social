-- Fix: editing a post doubled the hashtags.post_count for any tag the post
-- still uses. The UPDATE branch deleted post_hashtags rows for the post but
-- never decremented the counts those rows represented, so the next pass'
-- per-tag bump compounded on top of the prior count.
--
-- New behavior: on UPDATE, decrement post_count for the tags this post
-- previously had, then drop the linking rows, then re-extract from the new
-- content (which re-bumps counts to their correct value).

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
  IF TG_OP = 'UPDATE' THEN
    -- Decrement counts for the tags this post currently links to BEFORE
    -- dropping the link rows, so we don't lose track of which counts to
    -- adjust.
    UPDATE public.hashtags h
    SET post_count = GREATEST(post_count - 1, 0)
    FROM public.post_hashtags ph
    WHERE ph.post_id = NEW.id AND ph.hashtag_id = h.id;

    DELETE FROM public.post_hashtags WHERE post_id = NEW.id;
  END IF;

  IF NEW.content IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT lower(m[1])
    FROM regexp_matches(NEW.content, '(?:^|\s)#([a-zA-Z0-9_]{2,50})', 'g') m
  ) INTO matches;

  IF matches IS NULL OR array_length(matches, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  FOREACH tag IN ARRAY matches LOOP
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

-- One-shot recompute: rebuild hashtags.post_count from the actual
-- post_hashtags links so any inflated counts from previous edits get
-- corrected.
UPDATE public.hashtags h
SET post_count = COALESCE((
  SELECT COUNT(*) FROM public.post_hashtags ph WHERE ph.hashtag_id = h.id
), 0);
