import type { Request, Response } from 'express';
import { requireUser } from '../../utils/requireUser';
import { listTasksQuerySchema, taskIdParamsSchema, updateTaskSchema } from './tasks.schemas';
import * as tasksService from './tasks.service';

export async function list(req: Request, res: Response) {
  const query = listTasksQuerySchema.parse(req.query);
  res.json(await tasksService.list(requireUser(req), query));
}

export async function getById(req: Request, res: Response) {
  const { id } = taskIdParamsSchema.parse(req.params);
  res.json({ task: await tasksService.getById(requireUser(req), id) });
}

export async function update(req: Request, res: Response) {
  const { id } = taskIdParamsSchema.parse(req.params);
  const input = updateTaskSchema.parse(req.body);
  const task = await tasksService.update(requireUser(req), id, input);
  req.log.info({ taskId: id, fields: Object.keys(input) }, 'Task updated');
  res.json({ task });
}

export async function remove(req: Request, res: Response) {
  const { id } = taskIdParamsSchema.parse(req.params);
  await tasksService.remove(requireUser(req), id);
  req.log.info({ taskId: id }, 'Task deleted');
  res.status(204).end();
}
