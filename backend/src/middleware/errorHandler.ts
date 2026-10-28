import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} not found`));
};

function normalize(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(
      400,
      'VALIDATION_ERROR',
      'Request validation failed',
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  // Database unreachable, connection dropped or pool exhausted: a transient outage, not a bug.
  // 503 tells clients and load balancers to retry; /health/ready reports the same condition.
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    (err instanceof Prisma.PrismaClientKnownRequestError &&
      ['P1001', 'P1002', 'P1008', 'P1017', 'P2024'].includes(err.code))
  ) {
    return new AppError(503, 'SERVICE_UNAVAILABLE', 'The service is temporarily unavailable');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        return AppError.conflict('A record with this value already exists');
      case 'P2025':
        return AppError.notFound();
      case 'P2003':
        return AppError.badRequest('Referenced record does not exist');
    }
  }

  // Malformed JSON body from express.json()
  if (err instanceof SyntaxError && 'body' in err) {
    return AppError.badRequest('Malformed JSON body');
  }

  if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  return new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}

/**
 * Single place that turns any thrown error into a consistent JSON response:
 * { error: { code, message, details?, requestId } }
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = normalize(err);

  if (appError.statusCode === 503) {
    req.log.warn(
      { err: { name: (err as Error)?.name, message: (err as Error)?.message } },
      'Database unavailable',
    );
  } else if (appError.statusCode >= 500) {
    req.log.error({ err }, 'Unhandled error');
  } else {
    req.log.debug({ err: { code: appError.code, message: appError.message } }, 'Request failed');
  }

  res.status(appError.statusCode).json({
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined ? { details: appError.details } : {}),
      requestId: req.id,
    },
  });
};
