-- Fix recursive RLS policies on conversation_members / conversations / messages.
-- The original policies (migrations 00004, 00015) queried conversation_members
-- from inside conversation_members's own SELECT policy, causing Postgres to
-- abort with infinite-recursion errors. Wrap the membership check in a
-- SECURITY DEFINER helper so the inner query bypasses RLS.

CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE conversation_id = p_conversation_id
      AND user_id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_admin(UUID) TO authenticated;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can view conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can view membership" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can read messages" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Group admins can add members" ON public.conversation_members;
DROP POLICY IF EXISTS "Group admins can remove members" ON public.conversation_members;
DROP POLICY IF EXISTS "Members can update own membership" ON public.conversation_members;

-- Recreate using helper functions
CREATE POLICY "Members can view conversations"
  ON public.conversations FOR SELECT
  USING (public.is_conversation_member(id));

CREATE POLICY "Members can view membership"
  ON public.conversation_members FOR SELECT
  USING (public.is_conversation_member(conversation_id));

CREATE POLICY "Members can read messages"
  ON public.messages FOR SELECT
  USING (public.is_conversation_member(conversation_id));

CREATE POLICY "Members can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_member(conversation_id)
  );

CREATE POLICY "Members can add members"
  ON public.conversation_members FOR INSERT
  WITH CHECK (
    -- Conversation creator (covers fresh DM and fresh group creation)
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
    -- Or an existing admin of the group
    OR public.is_conversation_admin(conversation_id)
  );

CREATE POLICY "Members can remove members"
  ON public.conversation_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR public.is_conversation_admin(conversation_id)
  );

CREATE POLICY "Members can update own membership"
  ON public.conversation_members FOR UPDATE
  USING (auth.uid() = user_id);
