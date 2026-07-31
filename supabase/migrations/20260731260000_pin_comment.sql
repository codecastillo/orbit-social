-- Author-pinned comments. Comments are posts rows with reply_to_id set, and
-- the only UPDATE policy on posts is owner-only, so a post author pinning
-- someone else's comment is silently blocked by RLS. Same workaround the
-- counter RPCs use: SECURITY DEFINER with the ownership check inside.
CREATE OR REPLACE FUNCTION public.pin_comment(p_comment_id UUID, p_pinned BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  SELECT reply_to_id INTO v_parent_id
  FROM posts WHERE id = p_comment_id;

  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'not a comment';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM posts WHERE id = v_parent_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'only the post author can pin a comment';
  END IF;

  -- One pinned comment per post: clear any sibling pin first.
  IF p_pinned THEN
    UPDATE posts SET is_pinned = FALSE
    WHERE reply_to_id = v_parent_id AND is_pinned = TRUE;
  END IF;

  UPDATE posts SET is_pinned = p_pinned WHERE id = p_comment_id;
END;
$$;
