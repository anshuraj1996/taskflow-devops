import type { Request, Response } from 'express';
import { requireUser } from '../../utils/requireUser';
import { listUsersQuerySchema, updateRoleSchema, userIdParamsSchema } from './users.schemas';
import * as usersService from './users.service';

export async function me(req: Request, res: Response) {
  const user = await usersService.getById(requireUser(req).id);
  res.json({ user });
}

export async function list(req: Request, res: Response) {
  const query = listUsersQuerySchema.parse(req.query);
  res.json(await usersService.list(query));
}

export async function updateRole(req: Request, res: Response) {
  const { id } = userIdParamsSchema.parse(req.params);
  const { role } = updateRoleSchema.parse(req.body);
  const user = await usersService.updateRole(requireUser(req), id, role);
  req.log.info({ targetUserId: id, role }, 'User role changed');
  res.json({ user });
}
