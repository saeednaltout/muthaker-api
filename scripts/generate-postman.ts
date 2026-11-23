/**
 * Converts the committed openapi/openapi.json into a deterministic Postman collection
 * + environments. Usage: npm run postman:generate (regenerates openapi.json first).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { OpenAPIObject } from '@nestjs/swagger';

import { buildPostmanFiles } from './lib/postman';

const ROOT = join(__dirname, '..');

async function main(): Promise<void> {
  const spec = JSON.parse(
    readFileSync(join(ROOT, 'openapi', 'openapi.json'), 'utf8'),
  ) as OpenAPIObject;
  const files = await buildPostmanFiles(spec);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(ROOT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    process.stdout.write(`Wrote ${rel}\n`);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
