import type { IncomingMessage, ServerResponse } from 'node:http';
import { genRequestId } from '../../src/middleware/requestId';

function call(header?: string) {
  const req = {
    headers: header === undefined ? {} : { 'x-request-id': header },
  } as IncomingMessage;
  const setHeader = jest.fn();
  const id = genRequestId(req, { setHeader } as unknown as ServerResponse);
  return { id, setHeader };
}

describe('genRequestId', () => {
  it('reuses a well-formed inbound request id and echoes it back', () => {
    const { id, setHeader } = call('abc-123.trace_1');
    expect(id).toBe('abc-123.trace_1');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'abc-123.trace_1');
  });

  it('generates a UUID when the header is missing', () => {
    expect(call().id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('ignores unsafe values to avoid log injection', () => {
    const { id } = call('bad id\nwith newline');
    expect(id).not.toContain('\n');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
