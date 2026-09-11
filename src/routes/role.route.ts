import { Router } from 'express';
import { container } from '../config/di';
import { RoleController } from '../controllers/role.controller';
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
const roleController = container.resolve(RoleController);

router.get('/', validate(taxonomyListSchema), authenticate, roleController.getRoles);
router.get('/:id', validate(taxonomyGetSchema), authenticate, roleController.getRoleById);
router.post('/', validate(taxonomyCreateSchema), authenticate, authorize('ADMIN'), roleController.createRole);
router.put('/:id', validate(taxonomyUpdateSchema), authenticate, authorize('ADMIN'), roleController.updateRole);
router.delete('/:id', validate(taxonomyDeleteSchema), authenticate, authorize('ADMIN'), roleController.deleteRole);

export default router;
