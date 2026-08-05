-- Adding p_join_policy and p_rules as a wider overload in the previous
-- migration left both signatures callable, and every existing client call
-- passes exactly the seven named arguments the old one takes. Postgres cannot
-- choose between two candidates that both match a named-argument call and
-- raises "function is not unique", which broke renaming a room and changing
-- its images on both clients the moment the wider version landed.
--
-- The 9-argument version is a strict superset with identical defaults, so the
-- old signature has nothing left to do. Caught by calling the function with
-- the client's exact argument list rather than by reading the diff, which is
-- the only way this class of change shows itself.
DROP FUNCTION IF EXISTS public.update_community(
  UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN
);
