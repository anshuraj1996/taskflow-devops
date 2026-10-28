import { registerSchema } from '../../src/modules/auth/auth.schemas';
import { listTasksQuerySchema, updateTaskSchema } from '../../src/modules/tasks/tasks.schemas';

describe('request schemas', () => {
  it('normalizes email addresses on registration', () => {
    const parsed = registerSchema.parse({
      name: '  Ada ',
      email: '  Ada@Example.COM ',
      password: 'Password1',
    });
    expect(parsed).toEqual({ name: 'Ada', email: 'ada@example.com', password: 'Password1' });
  });

  it('rejects weak passwords', () => {
    expect(
      registerSchema.safeParse({ name: 'Ada', email: 'a@b.co', password: 'password' }).success,
    ).toBe(false);
  });

  it('parses comma-separated and repeated enum filters', () => {
    expect(listTasksQuerySchema.parse({ status: 'TODO,DONE' }).status).toEqual(['TODO', 'DONE']);
    expect(listTasksQuerySchema.parse({ status: ['TODO', 'BLOCKED'] }).status).toEqual([
      'TODO',
      'BLOCKED',
    ]);
    expect(listTasksQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
  });

  it('applies pagination defaults and caps the page size', () => {
    expect(listTasksQuerySchema.parse({})).toMatchObject({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
    });
    expect(listTasksQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejects empty task updates', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });
});
