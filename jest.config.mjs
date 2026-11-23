import { swcTransform } from './jest.swc.mjs';

/** Unit tests: src/**\/*.spec.ts. Prisma is mocked (jest-mock-extended); no infrastructure. */
export default {
  rootDir: '.',
  testEnvironment: 'node',
  moduleFileExtensions: ['ts', 'js', 'json'],
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: swcTransform,
  clearMocks: true,
  setupFiles: ['<rootDir>/test/unit/setup.ts'],
  collectCoverageFrom: [
    'src/**/*.service.ts',
    'src/modules/**/*.ts',
    'src/common/**/*.ts',
    'src/config/**/*.ts',
    'src/mail/mail.renderer.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/generated/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov'],
  // Raise over time, never lower.
  coverageThreshold: {
    global: { lines: 80, functions: 80 },
  },
};
