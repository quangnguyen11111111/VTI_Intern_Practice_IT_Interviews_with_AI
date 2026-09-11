import { Router } from 'express';
import { container } from '../config/di';
import { RoleController } from '../controllers/role.controller';
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
const roleController = container.resolve(RoleController);

router.get('/', validate(taxonomyListSchema), authenticate, roleController.getRoles);
router.get('/:id', validate(taxonomyGetSchema), authenticate, roleController.getRoleById);
router.post('/', authenticate, requireAdmin, validate(taxonomyCreateSchema), roleController.createRole);
router.put('/:id', authenticate, requireAdmin, validate(taxonomyUpdateSchema), roleController.updateRole);
router.delete('/:id', authenticate, requireAdmin, validate(taxonomyDeleteSchema), roleController.deleteRole);

export default router;
