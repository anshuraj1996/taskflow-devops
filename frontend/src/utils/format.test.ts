import { describe, expect, it } from 'vitest';
import { isOverdue } from './format';

describe('isOverdue', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('is true for an open task past its due date', () => {
    expect(isOverdue({ status: 'IN_PROGRESS', dueDate: '2026-06-14T23:59:59.000Z' }, now)).toBe(
      true,
    );
  });

  it('is false for completed tasks, future due dates and tasks without a due date', () => {
    expect(isOverdue({ status: 'DONE', dueDate: '2026-06-01T00:00:00.000Z' }, now)).toBe(false);
    expect(isOverdue({ status: 'TODO', dueDate: '2026-06-16T00:00:00.000Z' }, now)).toBe(false);
    expect(isOverdue({ status: 'TODO', dueDate: null }, now)).toBe(false);
  });
});
