import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const rateLimitBody = {
  error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' },
};

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitBody,
});

/** Stricter limit on credential endpoints to slow down brute-force attempts. */
export const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitBody,
});
