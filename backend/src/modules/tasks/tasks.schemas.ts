import { z } from 'zod';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { paginationSchema } from '../../utils/pagination';

export const taskIdParamsSchema = z.object({ id: z.string().uuid() });

const dueDate = z.coerce.date().nullable();

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(''),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueDate: dueDate.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(5000),
    status: z.nativeEnum(TaskStatus),
    priority: z.nativeEnum(TaskPriority),
    dueDate,
    assignedToId: z.string().uuid().nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

/** Accepts `?status=TODO&status=DONE` or `?status=TODO,DONE`. */
function csvEnum<T extends Record<string, string>>(values: T) {
  return z
    .union([z.string(), z.array(z.string())])
    .transform((raw) => (Array.isArray(raw) ? raw : raw.split(',')).map((v) => v.trim()))
    .pipe(z.array(z.nativeEnum(values)).min(1));
}

export const listTasksQuerySchema = paginationSchema.extend({
  projectId: z.string().uuid().optional(),
  status: csvEnum(TaskStatus).optional(),
  priority: csvEnum(TaskPriority).optional(),
  assignedTo: z.union([z.literal('me'), z.literal('unassigned'), z.string().uuid()]).optional(),
  overdue: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  q: z.string().trim().max(100).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
