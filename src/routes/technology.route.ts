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

const router = Router();
const technologyController = container.resolve(TechnologyController);

router.get('/', validate(technologyListSchema), technologyController.getTechnologies);
router.get('/:id', validate(taxonomyGetSchema), technologyController.getTechnologyById);
router.post('/', validate(technologyCreateSchema), technologyController.createTechnology);
router.put('/:id', validate(technologyUpdateSchema), technologyController.updateTechnology);
router.delete('/:id', validate(taxonomyDeleteSchema), technologyController.deleteTechnology);

export default router;
