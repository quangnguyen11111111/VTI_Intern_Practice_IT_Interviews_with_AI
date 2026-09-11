import { Router } from 'express';
import { container } from 'tsyringe';

import {
    authenticate,
    requireAdmin
} from '../middlewares/auth.middleware';

import { AdminMetricsController } from '../controllers/admin-metrics.controller';
import { validate } from '../middlewares/validate.middleware';
import { adminMetricsSchema } from '../validators/admin.validator';

const router = Router();

const controller =
   container.resolve(AdminMetricsController);

router.use(authenticate, requireAdmin);

router.get(
    '/metrics',
    validate(adminMetricsSchema),
    controller.getMetrics.bind(controller)
);

export default router;
