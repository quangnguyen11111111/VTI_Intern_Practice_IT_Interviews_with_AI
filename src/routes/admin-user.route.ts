import { Router } from 'express';
import { container } from 'tsyringe';

import { AdminUserController } from '../controllers/admin-user.controller';

const router = Router();

const controller =
  container.resolve(AdminUserController);

router.get(
  '/users',
  controller.getUsers.bind(controller)
);

router.patch(
  '/users/:id/lock',
  controller.lockUser.bind(controller)
);

router.patch(
  '/users/:id/unlock',
  controller.unlockUser.bind(controller)
);

export default router;