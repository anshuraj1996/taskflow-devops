import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Verifies the Bearer token and loads the user from the database, so that
 * deleted users and role changes take effect immediately rather than at token expiry.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized();
  }

  let userId: string;
  try {
    userId = verifyAccessToken(header.slice('Bearer '.length).trim()).sub;
  } catch {
    throw AppError.unauthorized('Invalid or expired token');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) {
    throw AppError.unauthorized('Invalid or expired token');
  }

  req.user = user;
  next();
};

/** Restricts a route to the given roles. Must run after `authenticate`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!roles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}
