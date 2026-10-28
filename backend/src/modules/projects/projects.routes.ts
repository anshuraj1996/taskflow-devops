import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/authenticate';
import * as controller from './projects.controller';

export const projectsRouter = Router();

projectsRouter.use(authenticate);

projectsRouter.post('/', requireRole(Role.ADMIN, Role.MANAGER), controller.create);
projectsRouter.get('/', controller.list);
projectsRouter.get('/:id', controller.getById);
projectsRouter.patch('/:id', controller.update); // owner/admin check is resource-level
projectsRouter.post('/:id/tasks', controller.createTask);
