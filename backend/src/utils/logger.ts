import pino, { type LoggerOptions } from 'pino';
import { env, isProduction } from '../config/env';

/** Shared options (exported so tests can verify redaction against an in-memory stream). */
export const loggerOptions: LoggerOptions = {
  level: env.LOG_LEVEL,
  base: { service: 'taskflow-api', env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'passwordHash',
      'accessToken',
      'token',
      '*.password',
      '*.passwordHash',
      '*.accessToken',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
};

/**
 * Structured JSON logger. In development the output is pretty-printed;
 * in production every line is a single JSON object suitable for log shippers.
 */
export const logger = pino({
  ...loggerOptions,
  ...(!isProduction && env.NODE_ENV !== 'test'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : {}),
});
