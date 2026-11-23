import { execSync } from 'node:child_process';

import { applyTestEnv } from './test-env';

/** Applies all migrations to the e2e database once per run (never `migrate dev`/`reset`). */
export default function globalSetup(): void {
  applyTestEnv();
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
