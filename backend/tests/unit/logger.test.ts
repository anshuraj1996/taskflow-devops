import { Writable } from 'node:stream';
import pino from 'pino';
import { loggerOptions } from '../../src/utils/logger';

function captureLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  return { log: pino({ ...loggerOptions, level: 'trace' }, stream), lines };
}

describe('logger redaction', () => {
  it('emits one JSON object per line with service metadata', () => {
    const { log, lines } = captureLogger();
    log.info({ userId: 'u1' }, 'hello');
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({ level: 30, service: 'taskflow-api', userId: 'u1', msg: 'hello' });
    expect(entry.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('redacts credentials at the top level and one level deep', () => {
    const { log, lines } = captureLogger();
    log.info(
      {
        password: 'TopLevelSecret1',
        token: 'eyJtop.level.token',
        req: { headers: { authorization: 'Bearer eyJabc.def.ghi', cookie: 'sid=1' } },
        body: { email: 'a@b.co', password: 'NestedSecret1' },
        user: { passwordHash: '$2b$12$hashhashhash' },
        result: { accessToken: 'eyJnested.access.token' },
      },
      'sensitive',
    );
    const out = lines.join('');
    for (const secret of [
      'TopLevelSecret1',
      'NestedSecret1',
      'eyJ',
      'Bearer',
      'sid=1',
      '$2b$12$',
    ]) {
      expect(out).not.toContain(secret);
    }
    expect(out).toContain('[REDACTED]');
    expect(out).toContain('a@b.co'); // non-secret fields are kept
  });
});
