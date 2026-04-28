-- comment_count on a post (clip or otherwise) should reflect the FULL
-- conversation tree, not just direct replies. Walk up reply_to_id from
-- any new/deleted reply and bump the root post's comment_count.
--
-- Also backfills comment_count on every existing root post to match the
-- recursive subtree size, so legacy clips with deep threads show the
-- correct number after this migration.

CREATE OR REPLACE FUNCTION update_post_count_on_post()
RETURNS TRIGGER AS $$
DECLARE
  v_root UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reply_to_id IS NOT NULL THEN
      -- Climb the reply chain to find the root post (the one with no
      -- reply_to_id). Cap at 64 hops as a safety against pathological
      -- cycles — real threads will never get close.
      WITH RECURSIVE chain AS (
        SELECT id, reply_to_id, 0 AS depth FROM posts WHERE id = NEW.reply_to_id
        UNION ALL
        SELECT p.id, p.reply_to_id, c.depth + 1
        FROM posts p
        JOIN chain c ON p.id = c.reply_to_id
        WHERE c.reply_to_id IS NOT NULL AND c.depth < 64
      )
      SELECT id INTO v_root FROM chain WHERE reply_to_id IS NULL LIMIT 1;
      IF v_root IS NOT NULL THEN
        UPDATE posts SET comment_count = comment_count + 1 WHERE id = v_root;
      END IF;
    END IF;
    UPDATE profiles SET post_count = post_count + 1 WHERE id = NEW.user_id;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.reply_to_id IS NOT NULL THEN
      WITH RECURSIVE chain AS (
        SELECT id, reply_to_id, 0 AS depth FROM posts WHERE id = OLD.reply_to_id
        UNION ALL
        SELECT p.id, p.reply_to_id, c.depth + 1
        FROM posts p
        JOIN chain c ON p.id = c.reply_to_id
        WHERE c.reply_to_id IS NOT NULL AND c.depth < 64
      )
      SELECT id INTO v_root FROM chain WHERE reply_to_id IS NULL LIMIT 1;
      IF v_root IS NOT NULL THEN
        UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = v_root;
      END IF;
    END IF;
    UPDATE profiles SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.user_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: for every root post, count its full descendant tree and
-- write that into comment_count. Uses a recursive CTE per root.
WITH RECURSIVE descendants AS (
  SELECT id AS root_id, id FROM posts WHERE reply_to_id IS NULL
  UNION ALL
  SELECT d.root_id, p.id
  FROM posts p
  JOIN descendants d ON p.reply_to_id = d.id
),
counts AS (
  SELECT root_id, COUNT(*) - 1 AS reply_count
  FROM descendants
  GROUP BY root_id
)
UPDATE posts p
SET comment_count = c.reply_count
FROM counts c
WHERE p.id = c.root_id
  AND p.comment_count IS DISTINCT FROM c.reply_count;
