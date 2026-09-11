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
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();
const technologyController = container.resolve(TechnologyController);

router.use(authenticate);

router.get('/', validate(technologyListSchema), technologyController.getTechnologies);
router.get('/:id', validate(taxonomyGetSchema), technologyController.getTechnologyById);
router.post('/', requireAdmin, validate(technologyCreateSchema), technologyController.createTechnology);
router.put('/:id', requireAdmin, validate(technologyUpdateSchema), technologyController.updateTechnology);
router.delete('/:id', requireAdmin, validate(taxonomyDeleteSchema), technologyController.deleteTechnology);

export default router;
