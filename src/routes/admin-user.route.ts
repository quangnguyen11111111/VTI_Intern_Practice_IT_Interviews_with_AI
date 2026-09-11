import { Router } from 'express';
import { container } from 'tsyringe';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

import { AdminUserController } from '../controllers/admin-user.controller';
import { validate } from '../middlewares/validate.middleware';
import { adminUserActionSchema, adminUserListSchema } from '../validators/admin.validator';

const router = Router();

const controller =
  container.resolve(AdminUserController);

router.use(authenticate, requireAdmin);

router.get(
  '/users',
  validate(adminUserListSchema),
  controller.getUsers.bind(controller)
);

router.patch(
  '/users/:id/lock',
  validate(adminUserActionSchema),
  controller.lockUser.bind(controller)
);

router.patch(
  '/users/:id/unlock',
  validate(adminUserActionSchema),
  controller.unlockUser.bind(controller)
);

export default router;
