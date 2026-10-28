import { type Prisma, type Project, Role } from '@prisma/client';
import { prisma } from '../../config/database';
import type { AuthUser } from '../../types/express';
import { AppError } from '../../utils/AppError';

/**
 * Authorization rules (resource level):
 *  - ADMIN sees and manages everything.
 *  - Everyone else only sees projects they are a member of (owners are always members).
 *  - A project is "managed" by its owner or an admin: rename, archive, change members,
 *    assign tasks to anyone, delete tasks.
 */

/** Prisma filter that restricts a project query to projects visible to the user. */
export function visibleProjectsWhere(user: AuthUser): Prisma.ProjectWhereInput {
  return user.role === Role.ADMIN ? {} : { members: { some: { userId: user.id } } };
}

/** Prisma filter that restricts a task query to tasks in projects visible to the user. */
export function visibleTasksWhere(user: AuthUser): Prisma.TaskWhereInput {
  return user.role === Role.ADMIN ? {} : { project: { members: { some: { userId: user.id } } } };
}

export function canManageProject(user: AuthUser, project: Pick<Project, 'ownerId'>): boolean {
  return user.role === Role.ADMIN || project.ownerId === user.id;
}

/**
 * Loads a project the user is allowed to see. Responds 404 (not 403) for projects
 * the user cannot see, so guessing IDs does not reveal which projects exist.
 */
export async function getAccessibleProject(user: AuthUser, projectId: string): Promise<Project> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...visibleProjectsWhere(user) },
  });
  if (!project) throw AppError.notFound('Project');
  return project;
}

export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { userId: true },
  });
  return membership !== null;
}

export function assertProjectActive(project: Pick<Project, 'status'>) {
  if (project.status === 'ARCHIVED') {
    throw AppError.conflict('Project is archived; unarchive it before changing its tasks');
  }
}
