import { swcTransform } from '../jest.swc.mjs';

/**
 * E2E tests against REAL infrastructure:
 *   postgres-test (5433), MinIO (9000), Mailpit (1025/8025). Start with `npm run infra:up`.
 * globalSetup applies migrations to the test database once.
 */
export default {
  rootDir: '..',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  transform: swcTransform,
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 30_000,
};
