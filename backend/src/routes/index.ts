import { Router } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes';
import { projectsRouter } from '../modules/projects/projects.routes';
import { tasksRouter } from '../modules/tasks/tasks.routes';
import { usersRouter } from '../modules/users/users.routes';

export const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use('/projects', projectsRouter);
v1Router.use('/tasks', tasksRouter);
v1Router.use('/dashboard', dashboardRouter);
