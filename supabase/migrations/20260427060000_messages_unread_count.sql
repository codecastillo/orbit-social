-- Stop posting "new message" rows into the notifications feed — the messages
-- tab now carries its own unread badge, so duplicating it as a notification is
-- noise.
DROP TRIGGER IF EXISTS on_message_notify ON public.messages;

-- Clean out any existing message-type notifications so users' feeds don't
-- still show old "interacted with you" entries.
DELETE FROM public.notifications WHERE type = 'message';

-- RPC for the sidebar "Messages" badge: number of conversations where the
-- latest non-self, non-deleted message is newer than the member's last_read_at.
CREATE OR REPLACE FUNCTION public.unread_conversation_count(p_user_id UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT
  FROM public.conversation_members cm
  WHERE cm.user_id = p_user_id
    AND EXISTS (
      SELECT 1
      FROM public.messages m
      WHERE m.conversation_id = cm.conversation_id
        AND m.sender_id <> p_user_id
        AND COALESCE(m.is_deleted, FALSE) = FALSE
        AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
    );
$$;

GRANT EXECUTE ON FUNCTION public.unread_conversation_count(UUID) TO authenticated, anon;
