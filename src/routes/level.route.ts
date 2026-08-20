import { Router } from 'express';
import { container } from '../config/di';
import { LevelController } from '../controllers/level.controller';

const router = Router();
const levelController = container.resolve(LevelController);

router.get('/', levelController.getLevels);
router.get('/:id', levelController.getLevelById);
router.post('/', levelController.createLevel);
router.put('/:id', levelController.updateLevel);
router.delete('/:id', levelController.deleteLevel);

export default router;
