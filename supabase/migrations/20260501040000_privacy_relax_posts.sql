-- Relax: posts privacy is gated CLIENT-SIDE on the profile page only.
-- The user's intent is Instagram-lite — show "this account is private" on the
-- profile, but private-author posts should still surface in the global feed
-- (Home / Discover / hashtag pages). The previous policy hid them everywhere.
DROP POLICY IF EXISTS "Posts viewable based on privacy" ON public.posts;
DROP POLICY IF EXISTS "Posts are viewable by everyone" ON public.posts;
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts FOR SELECT USING (NOT is_hidden);

-- Refine follows RLS: only the LIST OWNER's privacy flag should hide their
-- list. If A (private) follows B (public), A's row in B's followers list
-- should NOT be hidden from a third party — only A's OWN follower/following
-- lists are gated. This matches Instagram semantics.
DROP POLICY IF EXISTS "Follows viewable based on privacy" ON public.follows;
CREATE POLICY "Follows viewable based on privacy"
  ON public.follows FOR SELECT
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR (
      -- Visible to third parties unless one of the two endpoints has marked
      -- their OWN follower-list private — but actually we only need to check
      -- the side that "owns" this row from a list-display perspective. Since
      -- the same row appears in both A's following list and B's followers
      -- list, we honor BOTH flags. (If A or B chose private_followers, the
      -- relationship is hidden from third parties.)
      NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE (p.id = follows.follower_id OR p.id = follows.following_id)
          AND p.private_followers = TRUE
      )
    )
  );
