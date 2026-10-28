import type { Request, Response } from 'express';
import { requireUser } from '../../utils/requireUser';
import { createTaskSchema } from '../tasks/tasks.schemas';
import * as tasksService from '../tasks/tasks.service';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  updateProjectSchema,
} from './projects.schemas';
import * as projectsService from './projects.service';

export async function create(req: Request, res: Response) {
  const input = createProjectSchema.parse(req.body);
  const project = await projectsService.create(requireUser(req), input);
  req.log.info({ projectId: project.id }, 'Project created');
  res.status(201).json({ project });
}

export async function list(req: Request, res: Response) {
  const query = listProjectsQuerySchema.parse(req.query);
  res.json(await projectsService.list(requireUser(req), query));
}

export async function getById(req: Request, res: Response) {
  const { id } = projectIdParamsSchema.parse(req.params);
  res.json({ project: await projectsService.getById(requireUser(req), id) });
}

export async function update(req: Request, res: Response) {
  const { id } = projectIdParamsSchema.parse(req.params);
  const input = updateProjectSchema.parse(req.body);
  const project = await projectsService.update(requireUser(req), id, input);
  req.log.info({ projectId: id, fields: Object.keys(input) }, 'Project updated');
  res.json({ project });
}

export async function createTask(req: Request, res: Response) {
  const { id } = projectIdParamsSchema.parse(req.params);
  const input = createTaskSchema.parse(req.body);
  const task = await tasksService.create(requireUser(req), id, input);
  req.log.info({ projectId: id, taskId: task.id }, 'Task created');
  res.status(201).json({ task });
}
