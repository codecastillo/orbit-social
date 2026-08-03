-- Creator bell fanout for new_post notifications. The
-- post_notification_subscriptions RLS is own-rows (auth.uid() = user_id), so
-- an author cannot read who subscribed to them and a pure client-side fanout
-- is impossible. This SECURITY DEFINER function does the subscriber read on
-- the server; the client calls it right after a successful top-level post
-- create; the call is wrapped in a try/catch so publishing never blocks on
-- the fanout.
CREATE OR REPLACE FUNCTION public.fan_out_new_post(p_post_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author UUID;
  v_inserted INTEGER;
BEGIN
  -- Only the author may fan out, and only for a live, public, top-level,
  -- non-room post.
  SELECT user_id INTO v_author
  FROM posts
  WHERE id = p_post_id
    AND reply_to_id IS NULL
    AND community_id IS NULL
    AND is_hidden = false
    AND visibility = 'public';

  IF v_author IS NULL OR v_author <> auth.uid() THEN
    RETURN 0;
  END IF;

  -- new_followers_posts also gates push delivery in the notify webhook; the
  -- join here keeps the in-app rows consistent with that preference. The
  -- NOT EXISTS guard makes a double call (client retry) idempotent.
  INSERT INTO notifications (user_id, actor_id, type, entity_type, entity_id)
  SELECT s.user_id, v_author, 'new_post'::notification_type, 'post', p_post_id
  FROM post_notification_subscriptions s
  LEFT JOIN notification_preferences np ON np.user_id = s.user_id
  WHERE s.creator_id = v_author
    AND COALESCE(np.new_followers_posts, true)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.user_id = s.user_id
        AND n.type = 'new_post'::notification_type
        AND n.entity_id = p_post_id
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;
