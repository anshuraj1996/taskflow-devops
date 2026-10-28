import { randomUUID } from 'node:crypto';
import { Role, type TaskPriority, type TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/database';
import { signAccessToken } from '../../src/utils/jwt';

export const TEST_PASSWORD = 'Password123';
const passwordHash = bcrypt.hashSync(TEST_PASSWORD, 4);

/**
 * Clears all tables between tests. DELETE is used instead of TRUNCATE because the
 * tables are tiny and TRUNCATE's file rewrite + fsync is very slow on Docker Desktop volumes.
 */
export async function resetDatabase() {
  await prisma.$transaction([
    prisma.taskActivity.deleteMany(),
    prisma.task.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  token: string;
  auth: { Authorization: string };
}

export async function createUser(
  role: Role = Role.MEMBER,
  name = `${role} user`,
): Promise<TestUser> {
  const user = await prisma.user.create({
    data: { name, email: `${randomUUID()}@test.dev`, passwordHash, role },
  });
  const token = signAccessToken({ sub: user.id, role: user.role });
  return { ...user, token, auth: { Authorization: `Bearer ${token}` } };
}

export async function createProject(
  owner: TestUser,
  members: TestUser[] = [],
  name = 'Test project',
) {
  return prisma.project.create({
    data: {
      name,
      ownerId: owner.id,
      members: {
        createMany: { data: [owner, ...members].map((m) => ({ userId: m.id })) },
      },
    },
  });
}

export async function createTask(
  projectId: string,
  creator: TestUser,
  overrides: Partial<{
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date | null;
    assignedToId: string | null;
  }> = {},
) {
  return prisma.task.create({
    data: { title: 'A task', projectId, createdById: creator.id, ...overrides },
  });
}
