import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger';
import { genRequestId } from './requestId';

export const httpLogger = pinoHttp({
  logger,
  genReqId: genRequestId,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Probes are hit every few seconds; keep them out of the logs.
  autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
  customProps: (req) => ({ userId: (req as Express.Request).user?.id }),
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
