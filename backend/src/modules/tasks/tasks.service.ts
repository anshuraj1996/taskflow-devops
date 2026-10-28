import { ActivityAction, type Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { taskInclude } from '../../models';
import type { AuthUser } from '../../types/express';
import { AppError } from '../../utils/AppError';
import { paginate, toSkipTake } from '../../utils/pagination';
import {
  assertProjectActive,
  getAccessibleProject,
  isProjectMember,
  visibleTasksWhere,
} from '../projects/project.access';
import { canAssignTo, canDeleteTask, canEditTask } from './tasks.policy';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './tasks.schemas';

async function assertAssignable(
  user: AuthUser,
  project: { id: string; ownerId: string },
  assigneeId: string | null | undefined,
) {
  if (assigneeId === undefined) return;
  if (!canAssignTo(user, project, assigneeId)) {
    throw AppError.forbidden('Only the project owner or an admin can assign tasks to other people');
  }
  if (assigneeId !== null && !(await isProjectMember(project.id, assigneeId))) {
    throw AppError.badRequest('Assignee must be a member of the project');
  }
}

/** Loads a task the user can see, together with its project. 404 if not visible. */
async function getAccessibleTask(user: AuthUser, id: string) {
  const task = await prisma.task.findFirst({
    where: { id, ...visibleTasksWhere(user) },
    include: { project: true },
  });
  if (!task) throw AppError.notFound('Task');
  return task;
}

export async function create(user: AuthUser, projectId: string, input: CreateTaskInput) {
  const project = await getAccessibleProject(user, projectId);
  assertProjectActive(project);
  await assertAssignable(user, project, input.assignedToId);

  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: { ...input, projectId, createdById: user.id },
      include: taskInclude,
    });
    await tx.taskActivity.create({
      data: {
        taskId: task.id,
        projectId,
        actorId: user.id,
        action: ActivityAction.CREATED,
        details: { title: task.title },
      },
    });
    return task;
  });
}

function buildListWhere(user: AuthUser, query: ListTasksQuery): Prisma.TaskWhereInput {
  const filters: Prisma.TaskWhereInput[] = [visibleTasksWhere(user)];

  if (query.projectId) filters.push({ projectId: query.projectId });
  if (query.status) filters.push({ status: { in: query.status } });
  if (query.priority) filters.push({ priority: { in: query.priority } });
  if (query.q) filters.push({ title: { contains: query.q, mode: 'insensitive' } });

  if (query.assignedTo === 'me') filters.push({ assignedToId: user.id });
  else if (query.assignedTo === 'unassigned') filters.push({ assignedToId: null });
  else if (query.assignedTo) filters.push({ assignedToId: query.assignedTo });

  if (query.overdue === true) {
    filters.push({ dueDate: { lt: new Date() }, status: { not: TaskStatus.DONE } });
  } else if (query.overdue === false) {
    filters.push({
      OR: [{ dueDate: null }, { dueDate: { gte: new Date() } }, { status: TaskStatus.DONE }],
    });
  }

  return { AND: filters };
}

export async function list(user: AuthUser, query: ListTasksQuery) {
  const where = buildListWhere(user, query);
  const orderBy: Prisma.TaskOrderByWithRelationInput[] = [
    query.sortBy === 'dueDate'
      ? { dueDate: { sort: query.order, nulls: 'last' } }
      : { [query.sortBy]: query.order },
    { id: 'asc' }, // stable ordering across pages
  ];

  const [total, tasks] = await prisma.$transaction([
    prisma.task.count({ where }),
    prisma.task.findMany({ where, include: taskInclude, orderBy, ...toSkipTake(query) }),
  ]);
  return paginate(tasks, total, query);
}

export async function getById(user: AuthUser, id: string) {
  await getAccessibleTask(user, id);
  return prisma.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
}

export async function update(user: AuthUser, id: string, input: UpdateTaskInput) {
  const task = await getAccessibleTask(user, id);
  assertProjectActive(task.project);
  if (!canEditTask(user, task.project, task)) {
    throw AppError.forbidden('You can only update tasks assigned to or created by you');
  }
  if (input.assignedToId !== undefined && input.assignedToId !== task.assignedToId) {
    await assertAssignable(user, task.project, input.assignedToId);
  }

  const activities: Prisma.TaskActivityCreateManyInput[] = [];
  const base = { taskId: id, projectId: task.projectId, actorId: user.id };

  if (input.status !== undefined && input.status !== task.status) {
    activities.push({
      ...base,
      action: ActivityAction.STATUS_CHANGED,
      details: { from: task.status, to: input.status },
    });
  }
  if (input.assignedToId !== undefined && input.assignedToId !== task.assignedToId) {
    activities.push({
      ...base,
      action: ActivityAction.ASSIGNED,
      details: { from: task.assignedToId, to: input.assignedToId },
    });
  }
  const otherFields = Object.keys(input).filter((k) => k !== 'status' && k !== 'assignedToId');
  if (otherFields.length > 0) {
    activities.push({ ...base, action: ActivityAction.UPDATED, details: { fields: otherFields } });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data: input, include: taskInclude });
    if (activities.length > 0) await tx.taskActivity.createMany({ data: activities });
    return updated;
  });
}

export async function remove(user: AuthUser, id: string) {
  const task = await getAccessibleTask(user, id);
  if (!canDeleteTask(user, task.project)) {
    throw AppError.forbidden('Only the project owner or an admin can delete tasks');
  }

  await prisma.$transaction([
    prisma.taskActivity.create({
      data: {
        taskId: null,
        projectId: task.projectId,
        actorId: user.id,
        action: ActivityAction.DELETED,
        details: { title: task.title, taskId: id },
      },
    }),
    prisma.task.delete({ where: { id } }),
  ]);
}
