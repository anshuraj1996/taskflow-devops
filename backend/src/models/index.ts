import type { Prisma } from '@prisma/client';

export { Role, ProjectStatus, TaskStatus, TaskPriority, ActivityAction } from '@prisma/client';

/** Fields that are safe to return to clients. Never select passwordHash in responses. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const userSummarySelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export const taskInclude = {
  assignedTo: { select: userSummarySelect },
  createdBy: { select: userSummarySelect },
  project: { select: { id: true, name: true, status: true } },
} satisfies Prisma.TaskInclude;
