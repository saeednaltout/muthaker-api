/**
 * Writes openapi/openapi.json (sorted keys → deterministic, reviewable diffs).
 * Usage: npm run openapi:generate
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { createOpenApiDocument } from './lib/openapi';
import { stableStringify } from './lib/stable-json';

export const OPENAPI_PATH = join(__dirname, '..', 'openapi', 'openapi.json');

async function main(): Promise<void> {
  const document = await createOpenApiDocument();
  mkdirSync(join(OPENAPI_PATH, '..'), { recursive: true });
  writeFileSync(OPENAPI_PATH, stableStringify(document));
  process.stdout.write(`Wrote ${OPENAPI_PATH}\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
