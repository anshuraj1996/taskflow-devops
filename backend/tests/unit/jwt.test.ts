import { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt';

describe('jwt utils', () => {
  it('round-trips the subject and role', () => {
    const token = signAccessToken({ sub: 'user-1', role: Role.MANAGER });
    expect(verifyAccessToken(token)).toEqual({ sub: 'user-1', role: Role.MANAGER });
  });

  it('rejects tokens signed with a different secret', () => {
    const forged = jwt.sign({ role: Role.ADMIN }, 'some-other-secret-that-is-long-enough!!', {
      subject: 'user-1',
      issuer: 'taskflow-api',
    });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it('rejects expired tokens', () => {
    const expired = jwt.sign({ role: Role.MEMBER }, process.env.JWT_SECRET!, {
      subject: 'user-1',
      issuer: 'taskflow-api',
      expiresIn: -10,
    });
    expect(() => verifyAccessToken(expired)).toThrow(jwt.TokenExpiredError);
  });

  it('rejects the "none" algorithm', () => {
    const unsigned = jwt.sign({ role: Role.ADMIN }, '', {
      subject: 'user-1',
      issuer: 'taskflow-api',
      algorithm: 'none',
    });
    expect(() => verifyAccessToken(unsigned)).toThrow();
  });
});
