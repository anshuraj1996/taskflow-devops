import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { httpLogger } from './middleware/httpLogger';
import { apiLimiter } from './middleware/rateLimit';
import { REQUEST_ID_HEADER } from './middleware/requestId';
import { healthRouter } from './modules/health/health.routes';
import { v1Router } from './routes';

/**
 * Builds the Express application without binding a port, so tests can drive it
 * with Supertest and server.ts can own the process lifecycle.
 */
export function createApp() {
  const app = express();

  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(httpLogger); // assigns req.id / X-Request-Id first so every later log line carries it
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      exposedHeaders: [REQUEST_ID_HEADER],
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  // Health probes are outside /api and not rate limited.
  app.use('/health', healthRouter);

  app.use('/api', apiLimiter);
  app.use('/api/v1', v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
