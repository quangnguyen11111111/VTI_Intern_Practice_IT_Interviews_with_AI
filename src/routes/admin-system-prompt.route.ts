import { Router } from 'express';
import { container } from 'tsyringe';

import {
  authenticate,
  requireAdmin
} from '../middlewares/auth.middleware';

import {
  SystemPromptController
} from '../controllers/system-prompt.controller';

const router = Router();

const controller =
  container.resolve(SystemPromptController);

router.use(
  authenticate,
  requireAdmin
);

router.post(
  '/',
  controller.createDraft.bind(controller)
);

router.get(
  '/',
  controller.listVersions.bind(controller)
);

router.get(
  '/:id',
  controller.getPrompt.bind(controller)
);

router.post(
  '/:id/publish',
  controller.publish.bind(controller)
);

router.post(
  '/:id/rollback',
  controller.rollback.bind(controller)
);

export default router;