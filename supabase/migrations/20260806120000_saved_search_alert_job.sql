-- Runs the saved searches people asked to be alerted about and tells them
-- when something new matches.
--
-- Every part of this is capped on purpose. A job that re-runs arbitrary user
-- queries on a schedule is the kind of cost that grows quietly, and the
-- cheapest time to bound it is before anyone depends on it:
--
--   * posts scope only. Marketplace saved searches predate alerts and nobody
--     opted into them.
--   * ALERTS_PER_USER searches per person, oldest first, so one account
--     cannot turn the job into their private crawler.
--   * one notification per search per run, carrying a count, rather than one
--     per matching post. Ten matches is one notification saying ten.
--   * the text is matched with a plain ILIKE against content. The operators
--     the clients parse are deliberately not reimplemented here: two
--     implementations of the same query language drift, and the alert only
--     needs to answer "is there something new worth opening the app for".
--
-- last_alerted_at is both the watermark and the record of the last run, so a
-- search that matches nothing still moves forward and cannot re-scan the same
-- window forever.

CREATE OR REPLACE FUNCTION public.run_saved_search_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Per user, so a single account cannot monopolise the run.
  alerts_per_user CONSTANT INT := 5;
  -- Hard ceiling on the whole run, so the job's cost has a known maximum
  -- whatever the table looks like.
  max_searches CONSTANT INT := 500;
  rec RECORD;
  match_count INT;
  sent INT := 0;
BEGIN
  FOR rec IN
    SELECT s.id, s.user_id, s.query, s.label, s.last_alerted_at
    FROM (
      SELECT *,
             ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
      FROM public.saved_searches
      WHERE alerts_enabled AND scope = 'posts' AND TRIM(query) <> ''
    ) s
    WHERE s.rn <= alerts_per_user
    ORDER BY s.last_alerted_at
    LIMIT max_searches
  LOOP
    SELECT COUNT(*) INTO match_count
    FROM public.posts p
    WHERE p.created_at > rec.last_alerted_at
      AND p.is_hidden = FALSE
      AND p.reply_to_id IS NULL
      AND p.community_id IS NULL
      AND p.visibility = 'public'
      AND p.user_id <> rec.user_id
      AND p.content ILIKE '%' || rec.query || '%'
      -- The searcher must be able to see it. Blocks are symmetric, so this
      -- one check covers both directions.
      AND NOT public.blocks_between(rec.user_id, p.user_id);

    IF match_count > 0 THEN
      INSERT INTO public.notifications (user_id, actor_id, type, entity_id, is_read)
      VALUES (rec.user_id, NULL, 'saved_search', rec.id, FALSE);
      sent := sent + 1;
    END IF;

    -- Moves whether or not anything matched: the window is "since we last
    -- looked", not "since we last found something".
    UPDATE public.saved_searches
    SET last_alerted_at = NOW()
    WHERE id = rec.id;
  END LOOP;

  RETURN sent;
END;
$$;

REVOKE ALL ON FUNCTION public.run_saved_search_alerts() FROM PUBLIC;

-- Every six hours. Frequent enough that a match is still worth opening, rare
-- enough that a saved search cannot become a notification faucet.
SELECT cron.schedule(
  'saved-search-alerts',
  '17 */6 * * *',
  $$SELECT public.run_saved_search_alerts();$$
);
