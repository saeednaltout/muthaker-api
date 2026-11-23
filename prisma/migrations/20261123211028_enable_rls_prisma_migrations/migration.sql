-- Prisma keeps its bookkeeping table in `public`; block it from the Supabase Data API too.
-- Conditional because Prisma's shadow database does not have this table.
DO $$
BEGIN
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
END
$$;
