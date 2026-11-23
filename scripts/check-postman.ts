/**
 * Regenerates openapi.json + Postman files into a temp dir and compares them with the
 * committed ones. Exits 1 if anything is outdated. Usage: npm run postman:check
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createOpenApiDocument } from './lib/openapi';
import { buildPostmanFiles } from './lib/postman';
import { stableStringify } from './lib/stable-json';

const ROOT = join(__dirname, '..');

function readOrEmpty(path: string): string {
  try {
    return readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
}

async function main(): Promise<void> {
  const spec = await createOpenApiDocument();
  const files: Record<string, string> = {
    'openapi/openapi.json': stableStringify(spec),
    ...(await buildPostmanFiles(spec)),
  };

  const tmp = mkdtempSync(join(tmpdir(), 'postman-check-'));
  const outdated: string[] = [];
  for (const [rel, content] of Object.entries(files)) {
    const out = join(tmp, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, content);
    if (readOrEmpty(join(ROOT, rel)) !== content) outdated.push(rel);
  }

  if (outdated.length > 0) {
    process.stderr.write(
      `Outdated files:\n${outdated.map((f) => `  - ${f}`).join('\n')}\n` +
        `(fresh copies in ${tmp})\n\n` +
        'Postman collection is outdated. Run: npm run postman:generate\n',
    );
    process.exit(1);
  }
  process.stdout.write('OpenAPI and Postman collection are up to date.\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
  process.exit(1);
});
