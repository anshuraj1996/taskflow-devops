import type { Request, Response } from 'express';
import { loginSchema, registerSchema } from './auth.schemas';
import * as authService from './auth.service';

export async function register(req: Request, res: Response) {
  const input = registerSchema.parse(req.body);
  const result = await authService.register(input);
  req.log.info({ userId: result.user.id }, 'User registered');
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  const input = loginSchema.parse(req.body);
  const result = await authService.login(input);
  req.log.info({ userId: result.user.id }, 'User logged in');
  res.json(result);
}

/**
 * Tokens are stateless JWTs, so logout is performed by the client discarding its token.
 * The endpoint exists so clients have a stable contract and so logouts appear in the logs.
 */
export function logout(req: Request, res: Response) {
  req.log.info({ userId: req.user?.id }, 'User logged out');
  res.status(204).end();
}
