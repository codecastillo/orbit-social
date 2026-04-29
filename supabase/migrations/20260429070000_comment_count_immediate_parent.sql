-- The 20260428060000 trigger only updates `comment_count` on the *root*
-- of the reply chain. That keeps the clip/post-level total correct, but
-- means an intermediate comment's `comment_count` stays 0 forever —
-- which is why "View N replies" never showed up under a sub-thread and
-- the first reply to a comment looked like it disappeared.
--
-- This patch updates the trigger to bump BOTH the immediate parent and
-- the (different) root, then backfills `comment_count` on every existing
-- post to its direct-children count.

CREATE OR REPLACE FUNCTION update_post_count_on_post()
RETURNS TRIGGER AS $$
DECLARE
  v_root UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reply_to_id IS NOT NULL THEN
      -- 1. Immediate parent always +1.
      UPDATE posts SET comment_count = comment_count + 1
        WHERE id = NEW.reply_to_id;

      -- 2. Walk the chain to the root and +1 there too (skipped when the
      -- root is the same row as the immediate parent — that's a
      -- top-level comment and step 1 already covered it).
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
    UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.user_id;

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
    UPDATE profiles SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill, in two passes that match the trigger's semantics:
--   * non-root posts: direct-children count
--   * root posts:    full subtree size (every reply, every depth)

UPDATE posts p
SET comment_count = (
  SELECT COUNT(*) FROM posts c WHERE c.reply_to_id = p.id
)
WHERE p.reply_to_id IS NOT NULL;

WITH RECURSIVE subtree AS (
  SELECT id AS root_id, id FROM posts WHERE reply_to_id IS NULL
  UNION ALL
  SELECT s.root_id, p.id
  FROM posts p
  JOIN subtree s ON p.reply_to_id = s.id
),
counts AS (
  SELECT root_id, COUNT(*) - 1 AS reply_count
  FROM subtree
  GROUP BY root_id
)
UPDATE posts p
SET comment_count = c.reply_count
FROM counts c
WHERE p.id = c.root_id
  AND p.reply_to_id IS NULL
  AND p.comment_count IS DISTINCT FROM c.reply_count;
