import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { userSummarySelect } from '../../models';
import type { AuthUser } from '../../types/express';
import { AppError } from '../../utils/AppError';
import { paginate, toSkipTake } from '../../utils/pagination';
import { canManageProject, getAccessibleProject, visibleProjectsWhere } from './project.access';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from './projects.schemas';

const projectListInclude = {
  owner: { select: userSummarySelect },
  _count: { select: { tasks: true, members: true } },
} satisfies Prisma.ProjectInclude;

async function assertUsersExist(ids: string[]) {
  if (ids.length === 0) return;
  const found = await prisma.user.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw AppError.badRequest('One or more memberIds do not exist');
}

export async function create(user: AuthUser, input: CreateProjectInput) {
  const memberIds = [...new Set([user.id, ...input.memberIds])];
  await assertUsersExist(memberIds);

  return prisma.project.create({
    data: {
      name: input.name,
      description: input.description,
      ownerId: user.id,
      members: { createMany: { data: memberIds.map((userId) => ({ userId })) } },
    },
    include: projectListInclude,
  });
}

export async function list(user: AuthUser, query: ListProjectsQuery) {
  const where: Prisma.ProjectWhereInput = {
    ...visibleProjectsWhere(user),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
  };

  const [total, projects] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      include: projectListInclude,
      orderBy: { updatedAt: 'desc' },
      ...toSkipTake(query),
    }),
  ]);
  return paginate(projects, total, query);
}

export async function getById(user: AuthUser, id: string) {
  await getAccessibleProject(user, id);

  const [project, statusCounts] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        owner: { select: userSummarySelect },
        members: {
          select: { joinedAt: true, user: { select: { ...userSummarySelect, role: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    }),
    prisma.task.groupBy({ by: ['status'], where: { projectId: id }, _count: { _all: true } }),
  ]);

  return {
    ...project,
    members: project.members.map((m) => ({ ...m.user, joinedAt: m.joinedAt })),
    taskCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
    canManage: canManageProject(user, project),
  };
}

export async function update(user: AuthUser, id: string, input: UpdateProjectInput) {
  const project = await getAccessibleProject(user, id);
  if (!canManageProject(user, project)) {
    throw AppError.forbidden('Only the project owner or an admin can update this project');
  }

  const { memberIds, ...fields } = input;

  return prisma.$transaction(async (tx) => {
    if (memberIds) {
      const nextMembers = [...new Set([project.ownerId, ...memberIds])];
      await assertUsersExist(nextMembers);

      await tx.projectMember.deleteMany({
        where: { projectId: id, userId: { notIn: nextMembers } },
      });
      await tx.projectMember.createMany({
        data: nextMembers.map((userId) => ({ projectId: id, userId })),
        skipDuplicates: true,
      });
      // Tasks must not stay assigned to people who no longer have access to the project.
      await tx.task.updateMany({
        where: { projectId: id, assignedToId: { notIn: nextMembers } },
        data: { assignedToId: null },
      });
    }

    return tx.project.update({ where: { id }, data: fields, include: projectListInclude });
  });
}
