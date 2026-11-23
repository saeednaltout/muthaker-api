import 'dotenv/config';

import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 config.
 * - Migrations always use DIRECT_URL (direct or session pooler, port 5432).
 *   NEVER run migrations through the Supabase transaction pooler (6543).
 * - The runtime client uses DATABASE_URL through @prisma/adapter-pg (see PrismaService).
 * - `prisma generate` does not need a database, so an empty URL is tolerated there.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? '',
  },
});
