/**
 * Child-process harness for shutdown.test.ts. Boots the real server entrypoint, starts a request
 * whose body is still uploading, raises SIGTERM through the same handler a container runtime would
 * trigger, then finishes the body. A graceful server must still answer that request before exiting.
 * `process.emit` is used because Windows cannot deliver POSIX signals to a process.
 */
import http from 'node:http';

const port = Number(process.env.PORT);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let inFlightStatus: number | null = null;

// The server calls process.exit() itself; report what the in-flight request received at that point.
process.on('exit', () => {
  process.stdout.write(`${JSON.stringify({ harness: 'in-flight', status: inFlightStatus })}\n`);
});

function getStatus(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    http
      .get({ port, path, headers: { connection: 'close' } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      })
      .on('error', reject);
  });
}

async function waitForReady() {
  for (let i = 0; i < 100; i++) {
    if ((await getStatus('/health/ready').catch(() => 0)) === 200) return;
    await sleep(100);
  }
  throw new Error('server never became ready');
}

async function main() {
  await import('../../src/server');
  await waitForReady();

  const body = JSON.stringify({ email: 'nobody@test.dev', password: 'NotARealPassword1' });
  const req = http.request({
    port,
    method: 'POST',
    path: '/api/v1/auth/login',
    headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
  });
  req.on('response', (res) => {
    inFlightStatus = res.statusCode ?? 0;
    res.resume();
  });
  req.on('error', () => (inFlightStatus = -1));

  req.write(body.slice(0, 10)); // headers + partial body: the server is now mid-request
  await sleep(300);
  process.emit('SIGTERM');
  await sleep(300); // shutdown has begun while the request is still open
  req.end(body.slice(10));
}

main().catch((err) => {
  process.stdout.write(`${JSON.stringify({ harness: 'error', message: String(err) })}\n`);
  process.exit(2);
});
