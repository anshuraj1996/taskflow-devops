import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/authenticate';
import * as controller from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);

usersRouter.get('/me', controller.me);
// Directory used by managers to pick project members.
usersRouter.get('/', requireRole(Role.ADMIN, Role.MANAGER), controller.list);
usersRouter.patch('/:id/role', requireRole(Role.ADMIN), controller.updateRole);
