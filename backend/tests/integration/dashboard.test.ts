import { Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/database';
import { createProject, createTask, createUser, resetDatabase } from '../helpers/factories';

const app = createApp();

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('GET /api/v1/dashboard/summary', () => {
  it('returns statistics scoped to the caller’s projects', async () => {
    const owner = await createUser(Role.MANAGER);
    const member = await createUser(Role.MEMBER);
    const outsider = await createUser(Role.MANAGER);
    const project = await createProject(owner, [member]);
    const archived = await createProject(owner, [], 'Archived');
    await prisma.project.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });
    const foreign = await createProject(outsider);

    const yesterday = new Date(Date.now() - 86_400_000);
    await createTask(project.id, owner, { status: 'TODO', priority: 'HIGH', dueDate: yesterday });
    await createTask(project.id, owner, { status: 'DONE', priority: 'LOW', dueDate: yesterday });
    await createTask(project.id, owner, { status: 'IN_PROGRESS', assignedToId: member.id });
    await createTask(foreign.id, outsider, { status: 'BLOCKED' });

    // Create one via the API so there is activity to report.
    await request(app)
      .post(`/api/v1/projects/${project.id}/tasks`)
      .set(owner.auth)
      .send({ title: 'Via API' })
      .expect(201);

    const res = await request(app).get('/api/v1/dashboard/summary').set(owner.auth).expect(200);

    expect(res.body.totals).toEqual({
      projects: 2,
      activeProjects: 1,
      archivedProjects: 1,
      tasks: 4,
      overdueTasks: 1,
      myOpenTasks: 0,
    });
    expect(res.body.tasksByStatus).toEqual({ TODO: 2, IN_PROGRESS: 1, BLOCKED: 0, DONE: 1 });
    expect(res.body.tasksByPriority).toEqual({ LOW: 1, MEDIUM: 2, HIGH: 1, URGENT: 0 });
    expect(res.body.recentActivity).toHaveLength(1);
    expect(res.body.recentActivity[0]).toMatchObject({
      action: 'CREATED',
      actor: { id: owner.id },
      task: { title: 'Via API' },
    });

    const memberRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set(member.auth)
      .expect(200);
    expect(memberRes.body.totals).toMatchObject({ projects: 1, tasks: 4, myOpenTasks: 1 });
  });
});
