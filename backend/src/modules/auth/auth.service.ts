import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { publicUserSelect, type PublicUser } from '../../models';
import { AppError } from '../../utils/AppError';
import { signAccessToken } from '../../utils/jwt';
import { hashPassword, verifyPassword } from '../../utils/password';
import type { LoginInput, RegisterInput } from './auth.schemas';

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
}

// Compared against when the email is unknown so that login takes the same time
// whether or not the account exists (prevents user enumeration via timing).
let dummyHash: Promise<string> | undefined;
const getDummyHash = () => (dummyHash ??= hashPassword(randomUUID()));

export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  try {
    // Self-registration always creates a MEMBER. Elevated roles are granted by an admin.
    const user = await prisma.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: publicUserSelect,
    });
    return { user, accessToken: signAccessToken({ sub: user.id, role: user.role }) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw AppError.conflict('An account with this email already exists');
    }
    throw err;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const record = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = await verifyPassword(
    input.password,
    record?.passwordHash ?? (await getDummyHash()),
  );
  if (!record || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const { passwordHash: _omit, ...user } = record;
  return { user, accessToken: signAccessToken({ sub: user.id, role: user.role }) };
}
