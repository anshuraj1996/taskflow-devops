import type { Prisma, Role } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../config/database';
import { publicUserSelect } from '../../models';
import { AppError } from '../../utils/AppError';
import { paginate, toSkipTake } from '../../utils/pagination';
import type { AuthUser } from '../../types/express';
import type { listUsersQuerySchema } from './users.schemas';

export async function getById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect });
  if (!user) throw AppError.notFound('User');
  return user;
}

export async function list(query: z.infer<typeof listUsersQuerySchema>) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' } },
            { email: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: publicUserSelect,
      orderBy: { name: 'asc' },
      ...toSkipTake(query),
    }),
  ]);
  return paginate(users, total, query);
}

export async function updateRole(actor: AuthUser, id: string, role: Role) {
  if (actor.id === id) {
    // Prevents an admin from accidentally locking everyone out of administration.
    throw AppError.badRequest('You cannot change your own role');
  }
  await getById(id);
  return prisma.user.update({ where: { id }, data: { role }, select: publicUserSelect });
}
