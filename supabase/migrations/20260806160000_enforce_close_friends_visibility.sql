-- SECURITY FIX
--
-- Close friends is enforced in client query code and nowhere else. The posts
-- SELECT policy checks is_hidden, blocks, and private accounts and never
-- looks at visibility; the stories policy checks only expiry and ownership.
-- Both clients fetch the rows and then filter them, which means the database
-- hands close-friends content to anyone who asks and it stays hidden only
-- while every query path remembers to hide it.
--
-- The help page says "Every post has an audience: public, or close friends
-- only", and of moments, "close friends is the control to use when you want
-- it private". Below the client, that control did not exist.
--
-- Nothing has leaked: there are currently zero close-friends posts and zero
-- stories. This lands before the feature is used, and before any further
-- visibility tier is built on the same foundation.
--
-- Each policy is replaced rather than joined by a second one: two permissive
-- policies on the same command are ORed, which would widen access instead of
-- narrowing it. Everything above the new clause is the previous policy,
-- unchanged.
--
-- No SECURITY DEFINER helper is needed. close_friends already carries a
-- "Friends can see their membership" policy (auth.uid() = friend_id), so a
-- viewer can read exactly the row that proves their own membership, which is
-- all the EXISTS below asks for.

DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT USING (
    NOT is_hidden
    AND NOT blocks_between(auth.uid(), user_id)
    AND (
      auth.uid() = user_id
      OR NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = posts.user_id
          AND (p.is_private OR p.deactivated_at IS NOT NULL)
      )
      OR EXISTS (
        SELECT 1 FROM public.follows f
        WHERE f.following_id = posts.user_id AND f.follower_id = auth.uid()
      )
    )
    AND (
      visibility IS DISTINCT FROM 'close_friends'
      OR auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.close_friends cf
        WHERE cf.user_id = posts.user_id AND cf.friend_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Active stories, plus your own archive" ON public.stories;
CREATE POLICY "Active stories, plus your own archive"
  ON public.stories FOR SELECT USING (
    (expires_at > now() OR auth.uid() = user_id)
    AND (
      visibility IS DISTINCT FROM 'close_friends'
      OR auth.uid() = user_id
      OR EXISTS (
        SELECT 1 FROM public.close_friends cf
        WHERE cf.user_id = stories.user_id AND cf.friend_id = auth.uid()
      )
    )
  );
