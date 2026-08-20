import { Router } from 'express';
import { container } from '../config/di';
import { RoleController } from '../controllers/role.controller';

const router = Router();
const roleController = container.resolve(RoleController);

router.get('/', roleController.getRoles);
router.get('/:id', roleController.getRoleById);
router.post('/', roleController.createRole);
router.put('/:id', roleController.updateRole);
router.delete('/:id', roleController.deleteRole);

export default router;
