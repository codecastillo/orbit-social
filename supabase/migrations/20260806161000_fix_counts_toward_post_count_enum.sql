-- CRITICAL FIX
--
-- posts.type is the post_type enum, not TEXT. counts_toward_post_count was
-- declared with a TEXT fourth parameter and update_post_count_on_post passed
-- NEW.type straight into it, so no function matched and every INSERT into
-- posts raised "function public.counts_toward_post_count(...) does not
-- exist". Posting was broken from the moment 20260805120000 applied, on both
-- clients, for every kind of post.
--
-- Nothing caught it. The migration succeeded, the function existed, the
-- trigger existed, and verifying all three said the change was in place. The
-- mismatch only appears when a row is actually inserted, and the only reason
-- it surfaced was an unrelated INSERT run while probing a different policy.
--
-- The lesson is the same one this project keeps relearning: confirming a
-- migration applied is not confirming it works. A write path has to be
-- exercised, not inspected.
--
-- The cast goes at the call sites so the helper keeps a single signature.

CREATE OR REPLACE FUNCTION public.update_post_count_on_post()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $fn$
DECLARE
  v_root UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reply_to_id IS NOT NULL THEN
      UPDATE posts SET comment_count = comment_count + 1
        WHERE id = NEW.reply_to_id;

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
         NEW.reply_to_id, NEW.community_id, NEW.is_hidden, NEW.type::text) THEN
      UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.user_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF public.counts_toward_post_count(
         NEW.reply_to_id, NEW.community_id, NEW.is_hidden, NEW.type::text)
       AND NOT public.counts_toward_post_count(
         OLD.reply_to_id, OLD.community_id, OLD.is_hidden, OLD.type::text) THEN
      UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.user_id;
    ELSIF public.counts_toward_post_count(
            OLD.reply_to_id, OLD.community_id, OLD.is_hidden, OLD.type::text)
          AND NOT public.counts_toward_post_count(
            NEW.reply_to_id, NEW.community_id, NEW.is_hidden, NEW.type::text) THEN
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
         OLD.reply_to_id, OLD.community_id, OLD.is_hidden, OLD.type::text) THEN
      UPDATE profiles SET post_count = GREATEST(post_count - 1, 0)
        WHERE id = OLD.user_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$fn$;
