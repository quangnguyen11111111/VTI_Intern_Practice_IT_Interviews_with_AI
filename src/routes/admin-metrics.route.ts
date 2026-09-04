import { Router } from 'express';
import { container } from 'tsyringe';

import {
    authenticate,
    requireAdmin
} from '../middlewares/auth.middleware';

import { AdminMetricsController } from '../controllers/admin-metrics.controller';

const router = Router();

const controller =
   container.resolve(AdminMetricsController);

router.use(authenticate, requireAdmin);

router.get(
    '/metrics',
    controller.getMetrics.bind(controller)
);

export default router;
