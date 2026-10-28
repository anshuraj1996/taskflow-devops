import type { Request } from 'express';
import type { AuthUser } from '../types/express';
import { AppError } from './AppError';

/** Narrows `req.user` for handlers mounted behind `authenticate`. */
export function requireUser(req: Request): AuthUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}
