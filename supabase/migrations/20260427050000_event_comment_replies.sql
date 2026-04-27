-- Threaded replies on event comments + notification when someone replies to you.
ALTER TABLE public.event_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.event_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_event_comments_parent
  ON public.event_comments(parent_id) WHERE parent_id IS NOT NULL;

-- Notify the parent comment's author (or event creator for top-level when desired).
CREATE OR REPLACE FUNCTION public.create_event_comment_reply_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_author UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT user_id INTO parent_author
    FROM public.event_comments
    WHERE id = NEW.parent_id;

    IF parent_author IS NOT NULL AND parent_author <> NEW.user_id THEN
      INSERT INTO public.notifications
        (user_id, actor_id, type, entity_type, entity_id, data)
      VALUES (
        parent_author,
        NEW.user_id,
        'comment'::notification_type,
        'event',
        NEW.event_id,
        jsonb_build_object('comment_id', NEW.id, 'parent_id', NEW.parent_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_comments_reply_notify ON public.event_comments;
CREATE TRIGGER event_comments_reply_notify
AFTER INSERT ON public.event_comments
FOR EACH ROW EXECUTE FUNCTION public.create_event_comment_reply_notification();
