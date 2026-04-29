-- Enforce case-insensitive unique room names. "Software Development"
-- and "software development" should collide; "Software Development
-- Beginners" should not.
--
-- Step 1: dedupe any existing rows that already share a name (case +
-- whitespace insensitive). Keep the earliest by created_at; append
-- " (2)", " (3)", … to later siblings so the unique index can be
-- created. Slug is already unique, so the slugs disambiguate the
-- per-row identity even before this rename.
WITH ranked AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(BTRIM(name))
      ORDER BY created_at, id
    ) AS rn
  FROM public.communities
)
UPDATE public.communities c
SET name = c.name || ' (' || r.rn || ')'
FROM ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- Step 2: case-insensitive uniqueness via a functional unique index.
-- A plain UNIQUE on name would only catch exact-case duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS communities_name_lower_unique
  ON public.communities (LOWER(BTRIM(name)));

-- Step 3: surface the violation as a clean app-friendly error from
-- the create_community / update_community RPCs by checking
-- proactively. (The UNIQUE INDEX is the source of truth either way.)
CREATE OR REPLACE FUNCTION public.community_name_taken(p_name TEXT, p_exclude UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities
    WHERE LOWER(BTRIM(name)) = LOWER(BTRIM(p_name))
      AND (p_exclude IS NULL OR id <> p_exclude)
  );
$$;

GRANT EXECUTE ON FUNCTION public.community_name_taken(TEXT, UUID) TO authenticated, anon;
