import { Role } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/database';
import { createUser, resetDatabase, TEST_PASSWORD } from '../helpers/factories';

const app = createApp();

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('POST /api/v1/auth/register', () => {
  it('creates a MEMBER account and returns a token without the password hash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Ada', email: 'Ada@Example.com', password: 'Password123', role: 'ADMIN' })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      name: 'Ada',
      email: 'ada@example.com',
      role: Role.MEMBER,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'ada@example.com' } });
    expect(stored.passwordHash).not.toBe('Password123');
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects duplicate emails with 409', async () => {
    const body = { name: 'Ada', email: 'ada@example.com', password: 'Password123' };
    await request(app).post('/api/v1/auth/register').send(body).expect(201);
    const res = await request(app).post('/api/v1/auth/register').send(body).expect(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('validates the request body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'A', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['name', 'email', 'password']),
    );
  });
});

describe('POST /api/v1/auth/login', () => {
  it('returns a token for valid credentials', async () => {
    const user = await createUser(Role.MANAGER);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email.toUpperCase(), password: TEST_PASSWORD })
      .expect(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('returns the same 401 for a wrong password and an unknown email', async () => {
    const user = await createUser();
    const wrongPassword = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'WrongPass1' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@test.dev', password: 'WrongPass1' })
      .expect(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });
});

describe('authentication middleware', () => {
  it('GET /users/me requires a token', async () => {
    await request(app).get('/api/v1/users/me').expect(401);
  });

  it('GET /users/me rejects a malformed token', async () => {
    await request(app).get('/api/v1/users/me').set('Authorization', 'Bearer not.a.jwt').expect(401);
  });

  it('GET /users/me rejects a token for a user that no longer exists', async () => {
    const user = await createUser();
    await prisma.user.delete({ where: { id: user.id } });
    await request(app).get('/api/v1/users/me').set(user.auth).expect(401);
  });

  it('GET /users/me returns the current user', async () => {
    const user = await createUser(Role.ADMIN, 'Ada Admin');
    const res = await request(app).get('/api/v1/users/me').set(user.auth).expect(200);
    expect(res.body.user).toMatchObject({ id: user.id, name: 'Ada Admin', role: Role.ADMIN });
  });

  it('POST /auth/logout returns 204 for an authenticated user', async () => {
    const user = await createUser();
    await request(app).post('/api/v1/auth/logout').set(user.auth).expect(204);
  });
});

describe('role management', () => {
  it('only admins can change roles, and the change applies immediately', async () => {
    const admin = await createUser(Role.ADMIN);
    const manager = await createUser(Role.MANAGER);
    const member = await createUser(Role.MEMBER);

    await request(app)
      .patch(`/api/v1/users/${member.id}/role`)
      .set(manager.auth)
      .send({ role: 'MANAGER' })
      .expect(403);

    await request(app)
      .patch(`/api/v1/users/${member.id}/role`)
      .set(admin.auth)
      .send({ role: 'MANAGER' })
      .expect(200);

    // Same (old) token now carries manager permissions because roles are read from the DB.
    await request(app)
      .post('/api/v1/projects')
      .set(member.auth)
      .send({ name: 'Promoted' })
      .expect(201);
  });

  it('members cannot list the user directory', async () => {
    const member = await createUser(Role.MEMBER);
    await request(app).get('/api/v1/users').set(member.auth).expect(403);
  });
});
