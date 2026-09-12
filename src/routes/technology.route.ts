import { Router } from 'express';
import { container } from '../config/di';
import { TechnologyController } from '../controllers/technology.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  taxonomyDeleteSchema,
  taxonomyGetSchema,
  technologyCreateSchema,
  technologyListSchema,
  technologyUpdateSchema,
} from '../validators/taxonomy.validator';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
const technologyController = container.resolve(TechnologyController);

router.get('/', validate(technologyListSchema), authenticate, technologyController.getTechnologies);
router.get('/:id', validate(taxonomyGetSchema), authenticate, technologyController.getTechnologyById);
router.post('/', validate(technologyCreateSchema), authenticate, authorize('ADMIN'), technologyController.createTechnology);
router.put('/:id', validate(technologyUpdateSchema), authenticate, authorize('ADMIN'), technologyController.updateTechnology);
router.delete('/:id', validate(taxonomyDeleteSchema), authenticate, authorize('ADMIN'), technologyController.deleteTechnology);

export default router;
