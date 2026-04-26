-- Race-free VOD view increment. Anyone (authenticated or anon) can call.

CREATE OR REPLACE FUNCTION increment_vod_views(p_vod_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_total BIGINT;
BEGIN
  UPDATE live_vods
  SET view_count = view_count + 1
  WHERE id = p_vod_id
  RETURNING view_count INTO new_total;
  RETURN new_total;
END;
$$;

REVOKE ALL ON FUNCTION increment_vod_views(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_vod_views(UUID) TO authenticated, anon;
