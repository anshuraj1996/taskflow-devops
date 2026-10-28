import { execSync } from 'node:child_process';
import { applyTestEnv } from './test-env';

/** Applies all migrations to the test database once before the integration suite. */
export default function globalSetup() {
  applyTestEnv();
  execSync('npx prisma migrate deploy', {
    cwd: `${__dirname}/..`,
    env: process.env,
    stdio: 'pipe',
  });
}
