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
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';

const router = Router();
const roleController = container.resolve(RoleController);

router.use(authenticate);

router.get('/', validate(taxonomyListSchema), roleController.getRoles);
router.get('/:id', validate(taxonomyGetSchema), roleController.getRoleById);
router.post('/', requireAdmin, validate(taxonomyCreateSchema), roleController.createRole);
router.put('/:id', requireAdmin, validate(taxonomyUpdateSchema), roleController.updateRole);
router.delete('/:id', requireAdmin, validate(taxonomyDeleteSchema), roleController.deleteRole);

export default router;
