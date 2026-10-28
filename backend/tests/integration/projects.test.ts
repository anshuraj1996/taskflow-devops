import { Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/database';
import { createProject, createTask, createUser, resetDatabase } from '../helpers/factories';

const app = createApp();

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/projects', () => {
  it('lets managers create projects and adds the owner as a member', async () => {
    const manager = await createUser(Role.MANAGER);
    const member = await createUser(Role.MEMBER);

    const res = await request(app)
      .post('/api/v1/projects')
      .set(manager.auth)
      .send({ name: 'Website', description: 'Redesign', memberIds: [member.id] })
      .expect(201);

    expect(res.body.project).toMatchObject({
      name: 'Website',
      ownerId: manager.id,
      status: 'ACTIVE',
    });
    expect(res.body.project._count.members).toBe(2);
  });

  it('forbids members from creating projects', async () => {
    const member = await createUser(Role.MEMBER);
    await request(app).post('/api/v1/projects').set(member.auth).send({ name: 'Nope' }).expect(403);
  });

  it('rejects unknown member ids', async () => {
    const manager = await createUser(Role.MANAGER);
    await request(app)
      .post('/api/v1/projects')
      .set(manager.auth)
      .send({ name: 'Website', memberIds: ['00000000-0000-4000-8000-000000000000'] })
      .expect(400);
  });
});

describe('GET /api/v1/projects', () => {
  it('lists only projects the user belongs to, while admins see all', async () => {
    const admin = await createUser(Role.ADMIN);
    const alice = await createUser(Role.MANAGER);
    const bob = await createUser(Role.MANAGER);
    await createProject(alice, [], 'Alice project');
    await createProject(bob, [], 'Bob project');

    const aliceRes = await request(app).get('/api/v1/projects').set(alice.auth).expect(200);
    expect(aliceRes.body.data.map((p: { name: string }) => p.name)).toEqual(['Alice project']);
    expect(aliceRes.body.meta).toMatchObject({ page: 1, total: 1, totalPages: 1 });

    const adminRes = await request(app).get('/api/v1/projects').set(admin.auth).expect(200);
    expect(adminRes.body.meta.total).toBe(2);
  });

  it('filters by status and paginates', async () => {
    const manager = await createUser(Role.MANAGER);
    for (let i = 0; i < 3; i++) await createProject(manager, [], `P${i}`);
    const archived = await createProject(manager, [], 'Old');
    await prisma.project.update({ where: { id: archived.id }, data: { status: 'ARCHIVED' } });

    const active = await request(app)
      .get('/api/v1/projects?status=ACTIVE&limit=2&page=2')
      .set(manager.auth)
      .expect(200);
    expect(active.body.meta).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    expect(active.body.data).toHaveLength(1);
  });
});

describe('GET /api/v1/projects/:id', () => {
  it('returns 404 (not 403) for projects of another team', async () => {
    const alice = await createUser(Role.MANAGER);
    const mallory = await createUser(Role.MANAGER);
    const project = await createProject(alice);

    await request(app).get(`/api/v1/projects/${project.id}`).set(mallory.auth).expect(404);
  });

  it('returns members, task counts and whether the caller can manage it', async () => {
    const owner = await createUser(Role.MANAGER);
    const member = await createUser(Role.MEMBER);
    const project = await createProject(owner, [member]);
    await createTask(project.id, owner, { status: 'DONE' });
    await createTask(project.id, owner, { status: 'TODO' });

    const res = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set(member.auth)
      .expect(200);
    expect(res.body.project.members).toHaveLength(2);
    expect(res.body.project.taskCounts).toEqual({ DONE: 1, TODO: 1 });
    expect(res.body.project.canManage).toBe(false);
  });

  it('validates the id parameter', async () => {
    const user = await createUser();
    await request(app).get('/api/v1/projects/not-a-uuid').set(user.auth).expect(400);
  });
});

describe('PATCH /api/v1/projects/:id', () => {
  it('lets the owner rename and archive the project', async () => {
    const owner = await createUser(Role.MANAGER);
    const project = await createProject(owner);

    const res = await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set(owner.auth)
      .send({ name: 'Renamed', status: 'ARCHIVED' })
      .expect(200);
    expect(res.body.project).toMatchObject({ name: 'Renamed', status: 'ARCHIVED' });
  });

  it('forbids project members who are not the owner', async () => {
    const owner = await createUser(Role.MANAGER);
    const otherManager = await createUser(Role.MANAGER);
    const project = await createProject(owner, [otherManager]);

    await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set(otherManager.auth)
      .send({ name: 'Hijacked' })
      .expect(403);
  });

  it('replaces members, keeps the owner, and unassigns tasks of removed members', async () => {
    const owner = await createUser(Role.MANAGER);
    const leaving = await createUser(Role.MEMBER);
    const joining = await createUser(Role.MEMBER);
    const project = await createProject(owner, [leaving]);
    const task = await createTask(project.id, owner, { assignedToId: leaving.id });

    await request(app)
      .patch(`/api/v1/projects/${project.id}`)
      .set(owner.auth)
      .send({ memberIds: [joining.id] })
      .expect(200);

    const members = await prisma.projectMember.findMany({ where: { projectId: project.id } });
    expect(members.map((m) => m.userId).sort()).toEqual([owner.id, joining.id].sort());
    expect(
      (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).assignedToId,
    ).toBeNull();

    // The removed member immediately loses access.
    await request(app).get(`/api/v1/projects/${project.id}`).set(leaving.auth).expect(404);
  });
});
