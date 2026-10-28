import { z } from 'zod';
import { ProjectStatus } from '@prisma/client';
import { paginationSchema } from '../../utils/pagination';

export const projectIdParamsSchema = z.object({ id: z.string().uuid() });

const memberIds = z.array(z.string().uuid()).max(200);

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).default(''),
  memberIds: memberIds.default([]),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000),
    status: z.nativeEnum(ProjectStatus),
    memberIds,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const listProjectsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ProjectStatus).optional(),
  q: z.string().trim().max(100).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
