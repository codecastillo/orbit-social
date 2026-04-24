-- Migration: Group chats enhancements, message pinning, post visibility, content warnings

-- 1. Message pinning
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;

-- 2. Post visibility (public / close_friends)
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'public';

-- 3. Content warning / spoiler tags
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS content_warning TEXT;

-- 4. RLS updates for conversation_members management
-- Allow group admins to add members
CREATE POLICY "Group admins can add members"
  ON conversation_members FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
    OR
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND c.created_by = auth.uid()
    )
  );

-- Allow group admins to remove members
CREATE POLICY "Group admins can remove members"
  ON conversation_members FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversation_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- Allow members to update their own membership (last_read_at, is_muted)
CREATE POLICY "Members can update own membership"
  ON conversation_members FOR UPDATE USING (
    auth.uid() = user_id
  );

-- Allow conversation creator to update conversation details
CREATE POLICY "Creator can update conversation"
  ON conversations FOR UPDATE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- Allow members to pin/unpin messages
CREATE POLICY "Members can pin messages"
  ON messages FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation_members
      WHERE conversation_id = messages.conversation_id
        AND user_id = auth.uid()
    )
  );

-- Index for pinned messages lookup
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(conversation_id) WHERE is_pinned = TRUE;

-- Index for post visibility
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility) WHERE visibility != 'public';
