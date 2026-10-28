import type { Server } from 'node:http';
import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { lifecycle } from './utils/lifecycle';
import { logger } from './utils/logger';

let server: Server | undefined;

async function shutdown(reason: string, exitCode = 0) {
  if (lifecycle.isShuttingDown()) return;
  lifecycle.beginShutdown();
  logger.info({ reason }, 'Shutting down gracefully');

  // Hard deadline in case open connections or the DB hang.
  const forceExit = setTimeout(() => {
    logger.error(
      { timeoutMs: env.SHUTDOWN_TIMEOUT_MS },
      'Graceful shutdown timed out; forcing exit',
    );
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    if (server) {
      // Stop accepting new connections and wait for in-flight requests to finish.
      await new Promise<void>((resolve, reject) =>
        server!.close((err) => (err ? reject(err) : resolve())),
      );
      logger.info('HTTP server closed');
    }
    await disconnectDatabase();
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    exitCode = 1;
  }

  logger.info({ exitCode }, 'Shutdown complete');
  process.exit(exitCode);
}

async function main() {
  await connectDatabase();

  const app = createApp();
  server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, 'TaskFlow API listening');
  });

  // Close idle keep-alive sockets promptly during shutdown.
  server.keepAliveTimeout = 5_000;
  server.headersTimeout = 6_000;
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  void shutdown('unhandledRejection', 1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  void shutdown('startup failure', 1);
});
