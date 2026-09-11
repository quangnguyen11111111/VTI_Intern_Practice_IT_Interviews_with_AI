import { Router } from 'express';
import { container } from '../config/di';
import { TechnologyController } from '../controllers/technology.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';
import {
  taxonomyDeleteSchema,
  taxonomyGetSchema,
  technologyCreateSchema,
  technologyListSchema,
  technologyUpdateSchema,
} from '../validators/taxonomy.validator';

const router = Router();
const technologyController = container.resolve(TechnologyController);

router.get('/', validate(technologyListSchema), authenticate, technologyController.getTechnologies);
router.get('/:id', validate(taxonomyGetSchema), authenticate, technologyController.getTechnologyById);
router.post('/', authenticate, requireAdmin, validate(technologyCreateSchema), technologyController.createTechnology);
router.put('/:id', authenticate, requireAdmin, validate(technologyUpdateSchema), technologyController.updateTechnology);
router.delete('/:id', authenticate, requireAdmin, validate(taxonomyDeleteSchema), technologyController.deleteTechnology);

export default router;
