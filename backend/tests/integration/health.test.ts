import { Prisma } from '@prisma/client';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/config/database';
import { lifecycle } from '../../src/utils/lifecycle';

const app = createApp();

afterAll(() => prisma.$disconnect());

describe('health endpoints', () => {
  it('GET /health/live reports the process is alive', async () => {
    const res = await request(app).get('/health/live').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('GET /health/ready checks the database', async () => {
    const res = await request(app).get('/health/ready').expect(200);
    expect(res.body).toEqual({ status: 'ready', checks: { database: 'up' } });
  });

  it('GET /health/ready returns 503 when the database is unreachable', async () => {
    jest.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(app).get('/health/ready').expect(503);
    expect(res.body.checks.database).toBe('down');
  });

  it('API calls return 503 SERVICE_UNAVAILABLE (not 500) while the database is unreachable', async () => {
    jest
      .spyOn(prisma.user, 'findUnique')
      .mockRejectedValueOnce(
        new Prisma.PrismaClientInitializationError("Can't reach database server", '6.0.0'),
      );
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.co', password: 'Password123' })
      .expect(503);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('GET /health/ready returns 503 while shutting down, but liveness stays up', async () => {
    jest.spyOn(lifecycle, 'isShuttingDown').mockReturnValue(true);
    await request(app).get('/health/ready').expect(503);
    await request(app).get('/health/live').expect(200);
    jest.restoreAllMocks();
  });

  it('echoes a provided X-Request-Id and generates one otherwise', async () => {
    const echoed = await request(app).get('/health/live').set('X-Request-Id', 'trace-abc');
    expect(echoed.headers['x-request-id']).toBe('trace-abc');

    const generated = await request(app).get('/api/v1/does-not-exist').expect(404);
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.body.error.requestId).toBe(generated.headers['x-request-id']);
  });

  it('returns 400 for malformed JSON bodies', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });
});
