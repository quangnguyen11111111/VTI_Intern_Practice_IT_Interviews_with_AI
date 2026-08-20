import { Router } from 'express';
import { container } from '../config/di';
import { TechnologyController } from '../controllers/technology.controller';

const router = Router();
const technologyController = container.resolve(TechnologyController);

router.get('/', technologyController.getTechnologies);
router.get('/:id', technologyController.getTechnologyById);
router.post('/', technologyController.createTechnology);
router.put('/:id', technologyController.updateTechnology);
router.delete('/:id', technologyController.deleteTechnology);

export default router;
