import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './tasks.controller';

export const tasksRouter = Router();

tasksRouter.use(authenticate);

// Task creation lives under POST /projects/:id/tasks; role rules are enforced per resource.
tasksRouter.get('/', controller.list);
tasksRouter.get('/:id', controller.getById);
tasksRouter.patch('/:id', controller.update);
tasksRouter.delete('/:id', controller.remove);
