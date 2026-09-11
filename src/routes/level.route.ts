import { Router } from 'express';
import { container } from '../config/di';
import { LevelController } from '../controllers/level.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  taxonomyCreateSchema,
  taxonomyDeleteSchema,
  taxonomyGetSchema,
  taxonomyListSchema,
  taxonomyUpdateSchema,
} from '../validators/taxonomy.validator';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
const levelController = container.resolve(LevelController);

router.get('/', validate(taxonomyListSchema), authenticate, levelController.getLevels);
router.get('/:id', validate(taxonomyGetSchema), authenticate, levelController.getLevelById);
router.post('/', validate(taxonomyCreateSchema), authenticate, authorize('ADMIN'), levelController.createLevel);
router.put('/:id', validate(taxonomyUpdateSchema), authenticate, authorize('ADMIN'), levelController.updateLevel);
router.delete('/:id', validate(taxonomyDeleteSchema), authenticate, authorize('ADMIN'), levelController.deleteLevel);

export default router;
