import { Router } from 'express';
import { container } from '../config/di';
import { LevelController } from '../controllers/level.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';
import {
  taxonomyCreateSchema,
  taxonomyDeleteSchema,
  taxonomyGetSchema,
  taxonomyListSchema,
  taxonomyUpdateSchema,
} from '../validators/taxonomy.validator';

const router = Router();
const levelController = container.resolve(LevelController);

router.get('/', validate(taxonomyListSchema), authenticate, levelController.getLevels);
router.get('/:id', validate(taxonomyGetSchema), authenticate, levelController.getLevelById);
router.post('/', authenticate, requireAdmin, validate(taxonomyCreateSchema), levelController.createLevel);
router.put('/:id', authenticate, requireAdmin, validate(taxonomyUpdateSchema), levelController.updateLevel);
router.delete('/:id', authenticate, requireAdmin, validate(taxonomyDeleteSchema), levelController.deleteLevel);

export default router;
