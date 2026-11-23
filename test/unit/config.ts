import type { ConfigService } from '@nestjs/config';

import { type Env, validateEnv } from '../../src/config/env.schema';
import { TEST_ENV } from '../test-env';

/** A ConfigService stand-in backed by the validated test env (+ overrides). */
export function testConfig(overrides: Record<string, string> = {}): ConfigService<Env, true> {
  const env = validateEnv({ ...TEST_ENV, ...overrides });
  return {
    get: (key: keyof Env) => env[key],
  } as unknown as ConfigService<Env, true>;
}
