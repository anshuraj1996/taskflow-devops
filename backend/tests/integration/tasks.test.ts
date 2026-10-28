import { Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/database';
import {
  createProject,
  createTask,
  createUser,
  resetDatabase,
  type TestUser,
} from '../helpers/factories';

const app = createApp();

let owner: TestUser;
let member: TestUser;
let outsider: TestUser;
let projectId: string;

beforeEach(async () => {
  await resetDatabase();
  owner = await createUser(Role.MANAGER, 'Owner');
  member = await createUser(Role.MEMBER, 'Member');
  outsider = await createUser(Role.MANAGER, 'Outsider');
  projectId = (await createProject(owner, [member])).id;
});

afterAll(() => prisma.$disconnect());

describe('POST /api/v1/projects/:id/tasks', () => {
  it('creates a task and records a CREATED activity', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(owner.auth)
      .send({
        title: 'Write tests',
        priority: 'HIGH',
        dueDate: '2030-01-01T00:00:00.000Z',
        assignedToId: member.id,
      })
      .expect(201);

    expect(res.body.task).toMatchObject({
      title: 'Write tests',
      status: 'TODO',
      priority: 'HIGH',
      assignedTo: { id: member.id },
      createdBy: { id: owner.id },
    });
    const activity = await prisma.taskActivity.findMany({ where: { taskId: res.body.task.id } });
    expect(activity.map((a) => a.action)).toEqual(['CREATED']);
  });

  it('lets members create tasks assigned to themselves but not to others', async () => {
    await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(member.auth)
      .send({ title: 'Mine', assignedToId: member.id })
      .expect(201);

    await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(member.auth)
      .send({ title: 'Yours', assignedToId: owner.id })
      .expect(403);
  });

  it('rejects assignees who are not project members', async () => {
    await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(owner.auth)
      .send({ title: 'X', assignedToId: outsider.id })
      .expect(400);
  });

  it('returns 404 for users outside the project', async () => {
    await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(outsider.auth)
      .send({ title: 'Sneaky' })
      .expect(404);
  });

  it('returns 409 when the project is archived', async () => {
    await prisma.project.update({ where: { id: projectId }, data: { status: 'ARCHIVED' } });
    await request(app)
      .post(`/api/v1/projects/${projectId}/tasks`)
      .set(owner.auth)
      .send({ title: 'Late' })
      .expect(409);
  });
});

describe('GET /api/v1/tasks', () => {
  beforeEach(async () => {
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);
    await createTask(projectId, owner, {
      title: 'Overdue',
      dueDate: yesterday,
      priority: 'URGENT',
    });
    await createTask(projectId, owner, { title: 'Done late', dueDate: yesterday, status: 'DONE' });
    await createTask(projectId, owner, {
      title: 'Upcoming',
      dueDate: tomorrow,
      assignedToId: member.id,
    });
    await createTask(projectId, owner, { title: 'Blocked', status: 'BLOCKED', priority: 'LOW' });

    const otherProject = await createProject(outsider);
    await createTask(otherProject.id, outsider, { title: 'Other team task' });
  });

  const titles = (res: request.Response) =>
    res.body.data.map((t: { title: string }) => t.title).sort();

  it('only returns tasks from visible projects', async () => {
    const res = await request(app).get('/api/v1/tasks').set(member.auth).expect(200);
    expect(res.body.meta.total).toBe(4);
    expect(titles(res)).not.toContain('Other team task');
  });

  it('filters by status, priority, assignee and overdue', async () => {
    const byStatus = await request(app).get('/api/v1/tasks?status=BLOCKED,DONE').set(owner.auth);
    expect(titles(byStatus)).toEqual(['Blocked', 'Done late']);

    const byPriority = await request(app).get('/api/v1/tasks?priority=URGENT').set(owner.auth);
    expect(titles(byPriority)).toEqual(['Overdue']);

    const mine = await request(app).get('/api/v1/tasks?assignedTo=me').set(member.auth);
    expect(titles(mine)).toEqual(['Upcoming']);

    const overdue = await request(app).get('/api/v1/tasks?overdue=true').set(owner.auth);
    expect(titles(overdue)).toEqual(['Overdue']);

    const search = await request(app).get('/api/v1/tasks?q=upcom').set(owner.auth);
    expect(titles(search)).toEqual(['Upcoming']);
  });

  it('paginates and sorts', async () => {
    const page1 = await request(app)
      .get('/api/v1/tasks?sortBy=priority&order=desc&limit=3&page=1')
      .set(owner.auth)
      .expect(200);
    expect(page1.body.meta).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });
    expect(page1.body.data[0].title).toBe('Overdue'); // URGENT first

    const page2 = await request(app)
      .get('/api/v1/tasks?sortBy=priority&order=desc&limit=3&page=2')
      .set(owner.auth);
    expect(page2.body.data).toHaveLength(1);
    expect(page2.body.data[0].title).toBe('Blocked'); // LOW last
  });

  it('rejects invalid query parameters', async () => {
    await request(app).get('/api/v1/tasks?status=NOT_A_STATUS').set(owner.auth).expect(400);
  });
});

describe('GET/PATCH/DELETE /api/v1/tasks/:id', () => {
  it('hides tasks from users outside the project', async () => {
    const task = await createTask(projectId, owner);
    await request(app).get(`/api/v1/tasks/${task.id}`).set(outsider.auth).expect(404);
    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(outsider.auth)
      .send({ status: 'DONE' })
      .expect(404);
    await request(app).delete(`/api/v1/tasks/${task.id}`).set(outsider.auth).expect(404);
  });

  it('lets the assignee change status and logs a STATUS_CHANGED activity', async () => {
    const task = await createTask(projectId, owner, { assignedToId: member.id });

    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(member.auth)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    expect(res.body.task.status).toBe('IN_PROGRESS');

    const activity = await prisma.taskActivity.findFirstOrThrow({ where: { taskId: task.id } });
    expect(activity).toMatchObject({
      action: 'STATUS_CHANGED',
      actorId: member.id,
      details: { from: 'TODO', to: 'IN_PROGRESS' },
    });
  });

  it('forbids members from editing tasks that are not theirs', async () => {
    const task = await createTask(projectId, owner, { assignedToId: owner.id });
    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(member.auth)
      .send({ status: 'DONE' })
      .expect(403);
  });

  it('forbids members from reassigning their task to someone else', async () => {
    const task = await createTask(projectId, owner, { assignedToId: member.id });
    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(member.auth)
      .send({ assignedToId: owner.id })
      .expect(403);
  });

  it('lets the owner reassign and records an ASSIGNED activity', async () => {
    const task = await createTask(projectId, owner);
    await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(owner.auth)
      .send({ assignedToId: member.id, title: 'Renamed' })
      .expect(200);

    const actions = await prisma.taskActivity.findMany({ where: { taskId: task.id } });
    expect(actions.map((a) => a.action).sort()).toEqual(['ASSIGNED', 'UPDATED']);
  });

  it('only lets the owner or an admin delete tasks', async () => {
    const admin = await createUser(Role.ADMIN);
    const t1 = await createTask(projectId, member, { assignedToId: member.id });
    const t2 = await createTask(projectId, owner);

    await request(app).delete(`/api/v1/tasks/${t1.id}`).set(member.auth).expect(403);
    await request(app).delete(`/api/v1/tasks/${t1.id}`).set(owner.auth).expect(204);
    await request(app).delete(`/api/v1/tasks/${t2.id}`).set(admin.auth).expect(204);

    expect(await prisma.task.count()).toBe(0);
    const deletions = await prisma.taskActivity.findMany({ where: { action: 'DELETED' } });
    expect(deletions).toHaveLength(2);
  });
});
