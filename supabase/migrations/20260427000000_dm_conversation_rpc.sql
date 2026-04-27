-- start_dm_conversation: atomically find-or-create a 1:1 conversation between
-- the calling user and another user. Runs as SECURITY DEFINER so it bypasses
-- the recursive conversation_members RLS policies that block the multi-step
-- client flow.
CREATE OR REPLACE FUNCTION public.start_dm_conversation(p_other_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self UUID := auth.uid();
  v_existing UUID;
  v_new UUID;
BEGIN
  IF v_self IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is null — must be authenticated';
  END IF;
  IF p_other_id IS NULL THEN
    RAISE EXCEPTION 'p_other_id is required';
  END IF;
  IF p_other_id = v_self THEN
    RAISE EXCEPTION 'cannot DM yourself';
  END IF;

  -- Find existing 1:1 conversation between the two users
  SELECT c.id INTO v_existing
  FROM conversations c
  WHERE c.is_group = FALSE
    AND EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id AND m.user_id = v_self)
    AND EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id AND m.user_id = p_other_id)
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Create the conversation
  INSERT INTO conversations (is_group, created_by, last_message_at)
  VALUES (FALSE, v_self, NOW())
  RETURNING id INTO v_new;

  -- Add both members
  INSERT INTO conversation_members (conversation_id, user_id, role)
  VALUES (v_new, v_self, 'member'),
         (v_new, p_other_id, 'member');

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_dm_conversation(UUID) TO authenticated;
