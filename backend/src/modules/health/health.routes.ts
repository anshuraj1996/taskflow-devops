import { Router } from 'express';
import { pingDatabase } from '../../config/database';
import { env } from '../../config/env';
import { lifecycle } from '../../utils/lifecycle';

export const healthRouter = Router();

/**
 * Liveness: is the process running and able to serve HTTP at all?
 * Deliberately does NOT touch the database — a DB outage should not cause
 * Kubernetes to restart otherwise healthy pods.
 */
healthRouter.get('/live', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness: should this instance receive traffic right now?
 * Fails while shutting down or when the database is unreachable.
 */
healthRouter.get('/ready', async (_req, res) => {
  res.set('Cache-Control', 'no-store');

  if (lifecycle.isShuttingDown()) {
    res.status(503).json({ status: 'shutting_down', checks: { database: 'skipped' } });
    return;
  }

  const dbOk = await pingDatabase(env.DB_READY_TIMEOUT_MS);
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ready' : 'not_ready',
    checks: { database: dbOk ? 'up' : 'down' },
  });
});
