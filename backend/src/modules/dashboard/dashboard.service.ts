import { ProjectStatus, TaskPriority, TaskStatus } from '@prisma/client';
import { prisma } from '../../config/database';
import { userSummarySelect } from '../../models';
import type { AuthUser } from '../../types/express';
import { visibleProjectsWhere, visibleTasksWhere } from '../projects/project.access';

function zeroFilled<K extends string>(keys: K[], rows: { key: K; count: number }[]) {
  const result = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
  for (const row of rows) result[row.key] = row.count;
  return result;
}

export async function getSummary(user: AuthUser) {
  const projectWhere = visibleProjectsWhere(user);
  const taskWhere = visibleTasksWhere(user);
  const now = new Date();

  const [projectsByStatus, tasksByStatus, tasksByPriority, overdue, myOpen, recentActivity] =
    await Promise.all([
      prisma.project.groupBy({ by: ['status'], where: projectWhere, _count: { _all: true } }),
      prisma.task.groupBy({ by: ['status'], where: taskWhere, _count: { _all: true } }),
      prisma.task.groupBy({ by: ['priority'], where: taskWhere, _count: { _all: true } }),
      prisma.task.count({
        where: { ...taskWhere, dueDate: { lt: now }, status: { not: TaskStatus.DONE } },
      }),
      prisma.task.count({
        where: { ...taskWhere, assignedToId: user.id, status: { not: TaskStatus.DONE } },
      }),
      prisma.taskActivity.findMany({
        where: { project: projectWhere },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          actor: { select: userSummarySelect },
          task: { select: { id: true, title: true } },
          project: { select: { id: true, name: true } },
        },
      }),
    ]);

  const projects = zeroFilled(
    Object.values(ProjectStatus),
    projectsByStatus.map((r) => ({ key: r.status, count: r._count._all })),
  );
  const byStatus = zeroFilled(
    Object.values(TaskStatus),
    tasksByStatus.map((r) => ({ key: r.status, count: r._count._all })),
  );
  const byPriority = zeroFilled(
    Object.values(TaskPriority),
    tasksByPriority.map((r) => ({ key: r.priority, count: r._count._all })),
  );

  return {
    totals: {
      projects: projects.ACTIVE + projects.ARCHIVED,
      activeProjects: projects.ACTIVE,
      archivedProjects: projects.ARCHIVED,
      tasks: Object.values(byStatus).reduce((sum, n) => sum + n, 0),
      overdueTasks: overdue,
      myOpenTasks: myOpen,
    },
    tasksByStatus: byStatus,
    tasksByPriority: byPriority,
    recentActivity,
  };
}
