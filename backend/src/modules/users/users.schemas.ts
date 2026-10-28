import { z } from 'zod';
import { Role } from '@prisma/client';
import { paginationSchema } from '../../utils/pagination';

export const userIdParamsSchema = z.object({ id: z.string().uuid() });

export const listUsersQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(100).optional(),
  role: z.nativeEnum(Role).optional(),
});

export const updateRoleSchema = z.object({ role: z.nativeEnum(Role) });
