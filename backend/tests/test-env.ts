import dotenv from 'dotenv';

const DEFAULT_TEST_DB = 'postgresql://taskflow:taskflow@localhost:5432/taskflow_test?schema=public';

/**
 * Environment for every test run. Points the app at the dedicated test database
 * so integration tests can truncate tables without touching development data.
 */
export function applyTestEnv() {
  dotenv.config({ quiet: true } as dotenv.DotenvConfigOptions);

  const testDb = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DB;
  if (!/test/i.test(new URL(testDb).pathname)) {
    throw new Error(`Refusing to run tests against a non-test database: ${testDb}`);
  }

  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: testDb,
    LOG_LEVEL: 'silent',
    JWT_SECRET: 'test-secret-that-is-definitely-longer-than-32-chars',
    JWT_EXPIRES_IN: '15m',
    BCRYPT_SALT_ROUNDS: '4',
    RATE_LIMIT_MAX: '10000',
    AUTH_RATE_LIMIT_MAX: '10000',
  });
}
