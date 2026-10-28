import type { Task } from '../services/types';

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFormatter.format(new Date(iso));

export function isOverdue(task: Pick<Task, 'dueDate' | 'status'>, now = new Date()): boolean {
  return task.status !== 'DONE' && task.dueDate !== null && new Date(task.dueDate) < now;
}
