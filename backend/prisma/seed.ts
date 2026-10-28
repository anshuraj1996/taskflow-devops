/* eslint-disable no-console */
/**
 * Seeds the development database with sample users, projects, tasks and activity.
 * WARNING: wipes existing data. Run with `npm run db:seed -w backend`.
 *
 * Set SEED_TASKS=20000 (for example) to generate a larger data set for checking
 * query plans and index usage with EXPLAIN ANALYZE.
 */
import 'dotenv/config';
import {
  ActivityAction,
  PrismaClient,
  Role,
  TaskPriority,
  TaskStatus,
  type Prisma,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const PASSWORD = 'Password123';
const TASK_COUNT = Number(process.env.SEED_TASKS ?? 40);

const pick = <T>(items: readonly T[], i: number): T => items[i % items.length];
const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database');
  }

  console.log('Clearing existing data…');
  await prisma.$transaction([
    prisma.taskActivity.deleteMany(),
    prisma.task.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const userData = [
    { name: 'Ada Admin', email: 'admin@taskflow.dev', role: Role.ADMIN },
    { name: 'Max Manager', email: 'manager@taskflow.dev', role: Role.MANAGER },
    { name: 'Mia Member', email: 'member@taskflow.dev', role: Role.MEMBER },
    { name: 'Leo Member', email: 'leo@taskflow.dev', role: Role.MEMBER },
    { name: 'Nina Manager', email: 'nina@taskflow.dev', role: Role.MANAGER },
  ];
  const users = await Promise.all(
    userData.map((u) => prisma.user.create({ data: { ...u, passwordHash } })),
  );
  const [admin, manager, mia, leo, nina] = users;

  const projects = await Promise.all([
    prisma.project.create({
      data: {
        name: 'Website Redesign',
        description: 'Refresh the marketing site and improve conversion.',
        ownerId: manager.id,
        members: { createMany: { data: [manager, mia, leo].map((u) => ({ userId: u.id })) } },
      },
    }),
    prisma.project.create({
      data: {
        name: 'Mobile App v2',
        description: 'Second major release of the mobile application.',
        ownerId: nina.id,
        members: { createMany: { data: [nina, leo].map((u) => ({ userId: u.id })) } },
      },
    }),
    prisma.project.create({
      data: {
        name: 'Platform Migration',
        description: 'Move workloads to Kubernetes.',
        ownerId: admin.id,
        members: { createMany: { data: [admin, manager].map((u) => ({ userId: u.id })) } },
      },
    }),
  ]);

  const memberships: Record<string, string[]> = {
    [projects[0].id]: [manager.id, mia.id, leo.id],
    [projects[1].id]: [nina.id, leo.id],
    [projects[2].id]: [admin.id, manager.id],
  };

  const statuses = Object.values(TaskStatus);
  const priorities = Object.values(TaskPriority);
  const verbs = ['Design', 'Implement', 'Review', 'Test', 'Document', 'Deploy', 'Refactor'];
  const nouns = ['login flow', 'navbar', 'API client', 'CI pipeline', 'dashboard', 'settings page'];

  console.log(`Creating ${TASK_COUNT} tasks…`);
  const tasks: Prisma.TaskCreateManyInput[] = Array.from({ length: TASK_COUNT }, (_, i) => {
    const project = pick(projects, i);
    const members = memberships[project.id];
    return {
      title: `${pick(verbs, i)} ${pick(nouns, i * 7)} #${i + 1}`,
      description: 'Generated sample task.',
      projectId: project.id,
      createdById: project.ownerId,
      assignedToId: i % 5 === 0 ? null : pick(members, Math.floor(i / projects.length)),
      status: pick(statuses, i * 3),
      priority: pick(priorities, i * 5),
      dueDate: i % 4 === 0 ? null : daysFromNow((i % 21) - 7), // some overdue, some upcoming
    };
  });
  for (let i = 0; i < tasks.length; i += 5000) {
    await prisma.task.createMany({ data: tasks.slice(i, i + 5000) });
  }

  const recent = await prisma.task.findMany({ take: 15, orderBy: { createdAt: 'desc' } });
  await prisma.taskActivity.createMany({
    data: recent.map((t, i) => ({
      taskId: t.id,
      projectId: t.projectId,
      actorId: t.createdById,
      action: i % 2 === 0 ? ActivityAction.CREATED : ActivityAction.STATUS_CHANGED,
      details: i % 2 === 0 ? { title: t.title } : { from: TaskStatus.TODO, to: t.status },
    })),
  });

  console.log('\nSeed complete. All accounts use the password:', PASSWORD);
  console.table(users.map((u) => ({ email: u.email, role: u.role })));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
