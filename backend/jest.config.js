/** @type {import('jest').Config} */
const shared = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      ...shared,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
    },
    {
      ...shared,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      globalSetup: '<rootDir>/tests/global-setup.ts',
      // Suites share one database, so the npm scripts run Jest with --runInBand.
    },
  ],
  testTimeout: 30_000,
  collectCoverageFrom: ['src/**/*.ts', '!src/server.ts', '!src/types/**'],
};
