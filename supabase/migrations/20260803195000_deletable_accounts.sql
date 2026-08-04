-- Account deletion has never worked for anyone who started a DM, created a
-- community, or filed a report: six foreign keys to profiles are NO ACTION,
-- so deleting the profile raises a constraint violation and the route
-- reports a generic database error. App stores require working in-app
-- deletion, so this is a compliance blocker as well as a broken promise.
--
-- Every column here becomes SET NULL rather than CASCADE on purpose:
-- cascading would delete other people's data (a shared group thread, a whole
-- community and its posts) or destroy moderation history that must outlive
-- the account it describes.

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_created_by_fkey,
  ADD CONSTRAINT conversations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- The community outlives its founder; remaining owners and moderators in
-- community_members keep running it.
ALTER TABLE public.communities
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.communities
  DROP CONSTRAINT IF EXISTS communities_created_by_fkey,
  ADD CONSTRAINT communities_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Reports survive their author, anonymized: a moderation record that
-- vanishes when the reporter deletes their account is a hole in the audit
-- trail and an abuse vector.
ALTER TABLE public.reports
  ALTER COLUMN reporter_id DROP NOT NULL;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey,
  ADD CONSTRAINT reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reported_user_id_fkey,
  ADD CONSTRAINT reports_reported_user_id_fkey
    FOREIGN KEY (reported_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reviewed_by_fkey,
  ADD CONSTRAINT reports_reviewed_by_fkey
    FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.report_appeals
  DROP CONSTRAINT IF EXISTS report_appeals_resolved_by_fkey,
  ADD CONSTRAINT report_appeals_resolved_by_fkey
    FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
