-- Baseline migration. Business tables start in M1 (V2 onwards).
--
-- All timestamps are stored in UTC (CLAUDE.md section 5). Make UTC the database default so that
-- ad-hoc queries and any client that doesn't set a session time zone see the same values as
-- the API.
DO $$
BEGIN
    EXECUTE format('ALTER DATABASE %I SET timezone TO %L', current_database(), 'UTC');
END
$$;
