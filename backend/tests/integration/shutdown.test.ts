import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('graceful shutdown', () => {
  it('drains in-flight requests, disconnects the database and exits 0 on SIGTERM', () => {
    const backendDir = path.resolve(__dirname, '../..');
    const result = spawnSync(
      process.execPath,
      [require.resolve('tsx/cli'), 'tests/fixtures/shutdown-harness.ts'],
      {
        cwd: backendDir,
        env: {
          ...process.env,
          PORT: String(40_000 + Math.floor(Math.random() * 10_000)),
          LOG_LEVEL: 'info',
        },
        encoding: 'utf8',
        // Boots a real server (tsx compile + DB connect); slow CI disks need headroom.
        timeout: 60_000,
      },
    );

    const lines = result.stdout
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .map((l) => JSON.parse(l));
    const messages = lines.map((l) => l.msg ?? l.harness);

    expect(result.status).toBe(0);
    // Every log line is structured JSON.
    expect(lines.length).toBeGreaterThan(0);
    // Ordered lifecycle: started -> shutdown begins -> HTTP drained -> DB closed -> done.
    const order = [
      'Database connected',
      'TaskFlow API listening',
      'Shutting down gracefully',
      'HTTP server closed',
      'Database disconnected',
      'Shutdown complete',
    ].map((m) => messages.indexOf(m));
    expect(order).not.toContain(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // The request that was in flight when SIGTERM arrived still got its (401) answer.
    expect(lines).toContainEqual({ harness: 'in-flight', status: 401 });
    expect(lines.find((l) => l.msg === 'Shutdown complete')).toMatchObject({ exitCode: 0 });
  }, 90_000);
});
