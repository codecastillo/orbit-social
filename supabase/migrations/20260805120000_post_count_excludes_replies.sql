-- profiles.post_count counted every row inserted into posts, so a profile's
-- "posts" figure included the author's replies and their room posts. On the
-- @dan account it read 13 against 7 real posts: 7 posts and clips, 5 replies,
-- and 1 room post.
--
-- The count now matches what a profile actually lists: top-level posts and
-- clips the author published publicly. Excluded, in each case because the
-- profile does not show them there:
--   * replies    - they belong to the thread they are in
--   * room posts - they belong to the room, which is why they are confined
--   * reposts    - someone else's post, and reposts carry their own count
--   * hidden     - covers scheduled posts, which are not published yet
--
-- The comment_count half of this trigger is unchanged.

-- One definition of "counts", shared by the trigger and the backfill so the
-- stored value and a recomputed value cannot drift apart.
CREATE OR REPLACE FUNCTION public.counts_toward_post_count(
  p_reply_to_id  UUID,
  p_community_id UUID,
  p_is_hidden    BOOLEAN,
  p_type         TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_reply_to_id IS NULL
     AND p_community_id IS NULL
     AND COALESCE(p_is_hidden, FALSE) = FALSE
     AND p_type IS DISTINCT FROM 'repost';
$$;

CREATE OR REPLACE FUNCTION public.update_post_count_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_root UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reply_to_id IS NOT NULL THEN
      -- 1. Immediate parent always +1.
      UPDATE posts SET comment_count = comment_count + 1
        WHERE id = NEW.reply_to_id;

      -- 2. Walk the chain to the root and +1 there too. Skipped when the
      -- root is the same row as the immediate parent, which is a top-level
      -- comment that step 1 already covered.
      WITH RECURSIVE chain AS (
        SELECT id, reply_to_id, 0 AS depth FROM posts WHERE id = NEW.reply_to_id
        UNION ALL
        SELECT p.id, p.reply_to_id, c.depth + 1
        FROM posts p
        JOIN chain c ON p.id = c.reply_to_id
        WHERE c.reply_to_id IS NOT NULL AND c.depth < 64
      )
      SELECT id INTO v_root FROM chain WHERE reply_to_id IS NULL LIMIT 1;
      IF v_root IS NOT NULL AND v_root <> NEW.reply_to_id THEN
        UPDATE posts SET comment_count = comment_count + 1 WHERE id = v_root;
      END IF;
    END IF;

    IF public.counts_toward_post_count(
         NEW.reply_to_id, NEW.community_id, NEW.is_hidden, NEW.type) THEN
      UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.user_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- A scheduled post publishing is an is_hidden flip, not an insert. That
    -- transition was never maintained, so a published scheduled post did not
    -- start counting until something else recomputed the value.
    IF public.counts_toward_post_count(
         NEW.reply_to_id, NEW.community_id, NEW.is_hidden, NEW.type)
       AND NOT public.counts_toward_post_count(
         OLD.reply_to_id, OLD.community_id, OLD.is_hidden, OLD.type) THEN
      UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.user_id;
    ELSIF public.counts_toward_post_count(
            OLD.reply_to_id, OLD.community_id, OLD.is_hidden, OLD.type)
          AND NOT public.counts_toward_post_count(
            NEW.reply_to_id, NEW.community_id, NEW.is_hidden, NEW.type) THEN
      UPDATE profiles SET post_count = GREATEST(post_count - 1, 0)
        WHERE id = NEW.user_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.reply_to_id IS NOT NULL THEN
      UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0)
        WHERE id = OLD.reply_to_id;

      WITH RECURSIVE chain AS (
        SELECT id, reply_to_id, 0 AS depth FROM posts WHERE id = OLD.reply_to_id
        UNION ALL
        SELECT p.id, p.reply_to_id, c.depth + 1
        FROM posts p
        JOIN chain c ON p.id = c.reply_to_id
        WHERE c.reply_to_id IS NOT NULL AND c.depth < 64
      )
      SELECT id INTO v_root FROM chain WHERE reply_to_id IS NULL LIMIT 1;
      IF v_root IS NOT NULL AND v_root <> OLD.reply_to_id THEN
        UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = v_root;
      END IF;
    END IF;

    IF public.counts_toward_post_count(
         OLD.reply_to_id, OLD.community_id, OLD.is_hidden, OLD.type) THEN
      UPDATE profiles SET post_count = GREATEST(post_count - 1, 0)
        WHERE id = OLD.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

-- The trigger fired on INSERT and DELETE only, so the publish transition
-- above would never reach it.
DROP TRIGGER IF EXISTS on_post_change ON public.posts;
CREATE TRIGGER on_post_change
AFTER INSERT OR DELETE
  OR UPDATE OF is_hidden, reply_to_id, community_id, type
ON public.posts
FOR EACH ROW EXECUTE FUNCTION public.update_post_count_on_post();

-- Backfill from the same rule, correcting the drift that has already
-- accumulated rather than only stopping it from growing.
UPDATE profiles pr
SET post_count = counted.n
FROM (
  SELECT p.id,
         (SELECT COUNT(*) FROM posts po
           WHERE po.user_id = p.id
             AND po.reply_to_id IS NULL
             AND po.community_id IS NULL
             AND po.is_hidden = FALSE
             AND po.type IS DISTINCT FROM 'repost') AS n
  FROM profiles p
) counted
WHERE pr.id = counted.id
  AND pr.post_count IS DISTINCT FROM counted.n;
