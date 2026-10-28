import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { requireUser } from '../../utils/requireUser';
import * as dashboardService from './dashboard.service';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate);

dashboardRouter.get('/summary', async (req, res) => {
  res.json(await dashboardService.getSummary(requireUser(req)));
});
