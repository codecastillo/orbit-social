-- Owner can delete their own community. ON DELETE CASCADE on referencing
-- tables (community_members, community_join_requests, posts.community_fk
-- which uses ON DELETE SET NULL) handles the cleanup.
DROP POLICY IF EXISTS "Owners can delete communities" ON public.communities;
CREATE POLICY "Owners can delete communities"
  ON public.communities FOR DELETE
  USING (auth.uid() = created_by);
