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

const router = Router();
const levelController = container.resolve(LevelController);

router.get('/', validate(taxonomyListSchema), levelController.getLevels);
router.get('/:id', validate(taxonomyGetSchema), levelController.getLevelById);
router.post('/', validate(taxonomyCreateSchema), levelController.createLevel);
router.put('/:id', validate(taxonomyUpdateSchema), levelController.updateLevel);
router.delete('/:id', validate(taxonomyDeleteSchema), levelController.deleteLevel);

export default router;
