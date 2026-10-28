import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  // 'minimal' keeps query arguments (e.g. passwordHash) out of error messages and therefore out of logs.
  errorFormat: 'minimal',
  // Query errors are not logged here: they are thrown to the caller, expected ones (e.g. a duplicate
  // email -> 409) are handled, and unexpected ones are logged once by the central error handler.
  log: [{ emit: 'event', level: 'warn' }],
});

prisma.$on('warn', (e) => logger.warn({ prisma: e }, 'Prisma warning'));

const RETRY_DELAY_MS = 2_000;

/** Connects with retries so the API tolerates the database starting a little later. */
export async function connectDatabase(maxAttempts = 10): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      logger.info('Database connected');
      return;
    } catch (err) {
      logger.warn({ err, attempt, maxAttempts }, 'Database connection failed');
      if (attempt === maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

/** Lightweight connectivity check used by the readiness probe. */
export async function pingDatabase(timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const ping = prisma.$queryRaw`SELECT 1`.then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([ping, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
