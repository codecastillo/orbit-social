-- Wave C batch: free emoji reactions, quote posts, plus small columns queued
-- by earlier waves.

-- Post reactions become free emoji glyphs, matching message_reactions.emoji.
-- Legacy names map to their glyphs so grouping is uniform afterwards.
ALTER TABLE public.post_reactions
  DROP CONSTRAINT IF EXISTS post_reactions_reaction_type_check;

-- The escapes below are reaction DATA (user-picked glyphs), written as
-- unicode escapes so no raw glyph characters sit in the repo source.
UPDATE public.post_reactions SET reaction_type = CASE reaction_type
  WHEN 'love'  THEN E'\u2764\ufe0f'
  WHEN 'fire'  THEN E'\U0001F525'
  WHEN 'laugh' THEN E'\U0001F602'
  WHEN 'sad'   THEN E'\U0001F622'
  WHEN 'wow'   THEN E'\U0001F62E'
  WHEN 'angry' THEN E'\U0001F621'
  ELSE reaction_type END
WHERE reaction_type IN ('love', 'fire', 'laugh', 'sad', 'wow', 'angry');

-- Both reaction columns are open TEXT reachable from the client API; a
-- length cap keeps them emoji-sized (ZWJ sequences included) and nothing
-- else.
ALTER TABLE public.post_reactions
  ADD CONSTRAINT post_reactions_emoji_len
  CHECK (char_length(reaction_type) BETWEEN 1 AND 16);
ALTER TABLE public.message_reactions
  ADD CONSTRAINT message_reactions_emoji_len
  CHECK (char_length(emoji) BETWEEN 1 AND 16);

-- Quote posts share repost_count (X-style combined). Reposts keep their
-- existing client RPCs; this trigger covers quotes only, because quotes are
-- deleted through the generic delete paths where no client decrement runs.
CREATE OR REPLACE FUNCTION public.maintain_quote_repost_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.type = 'quote' AND NEW.parent_post_id IS NOT NULL THEN
    UPDATE posts SET repost_count = COALESCE(repost_count, 0) + 1
    WHERE id = NEW.parent_post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.type = 'quote' AND OLD.parent_post_id IS NOT NULL THEN
    UPDATE posts SET repost_count = GREATEST(COALESCE(repost_count, 0) - 1, 0)
    WHERE id = OLD.parent_post_id;
    RETURN OLD;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_repost_count ON public.posts;
CREATE TRIGGER trg_quote_repost_count
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.maintain_quote_repost_count();

-- Notification producer for repost AND quote; neither had one, so reposts
-- have been silent since launch. Same pref-gated SECURITY DEFINER pattern as
-- the like/comment triggers. Quote notifications point at the quote post
-- (the commentary is the news); repost notifications point at the original.
CREATE OR REPLACE FUNCTION public.create_repost_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_author UUID;
BEGIN
  SELECT user_id INTO parent_author FROM posts WHERE id = NEW.parent_post_id;
  IF parent_author IS NULL OR parent_author = NEW.user_id THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE(
    (SELECT reposts FROM public.notification_preferences WHERE user_id = parent_author),
    TRUE
  ) THEN
    RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
  VALUES (
    parent_author,
    NEW.user_id,
    (NEW.type::text)::notification_type,
    'post',
    CASE WHEN NEW.type = 'quote' THEN NEW.id ELSE NEW.parent_post_id END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repost_notification ON public.posts;
CREATE TRIGGER trg_repost_notification
  AFTER INSERT ON public.posts
  FOR EACH ROW
  WHEN (NEW.type IN ('repost', 'quote') AND NEW.parent_post_id IS NOT NULL)
  EXECUTE FUNCTION public.create_repost_notification();

-- community_invite_user now tells the invitee, which the enum always
-- promised and nothing delivered.
CREATE OR REPLACE FUNCTION public.community_invite_user(p_community_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = p_community_id AND user_id = uid AND role IN ('owner', 'moderator')
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (p_community_id, p_user_id, 'member')
  ON CONFLICT DO NOTHING;

  IF FOUND AND p_user_id <> uid THEN
    INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
    VALUES (p_user_id, uid, 'community_invite', 'community', p_community_id);
  END IF;
END;
$$;

-- Columns queued by earlier waves, shipped behind graceful-degradation shims
-- that light up once these exist:
-- Onboarding interests (web onboarding has written this into a swallowed
-- error since launch).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests TEXT[] NOT NULL DEFAULT '{}';

-- Edited marker for DM edits.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Close conversation (archive until a newer message resurfaces it).
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
