/**
 * Fails (exit 1) if any table in the `public` schema has Row Level Security disabled.
 * Supabase exposes `public` through its Data API; RLS with no policies blocks it.
 * Usage: DATABASE_URL=... npm run db:check-rls   (CI runs it against the e2e database)
 */
import 'dotenv/config';

import { Client } from 'pg';

async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DIRECT_URL or DATABASE_URL is required');

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const { rows } = await client.query<{ table: string; rls: boolean }>(`
      SELECT c.relname AS "table", c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      ORDER BY c.relname`);

    const missing = rows.filter((r) => !r.rls).map((r) => r.table);
    if (rows.length === 0)
      throw new Error('No tables found in schema "public" (migrations applied?)');
    if (missing.length > 0) {
      process.stderr.write(
        `RLS is DISABLED on: ${missing.join(', ')}\n` +
          'Add `ALTER TABLE "<name>" ENABLE ROW LEVEL SECURITY;` to the migration.\n',
      );
      process.exit(1);
    }
    process.stdout.write(`RLS enabled on all ${rows.length} tables in public.\n`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
