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

const router = Router();
const roleController = container.resolve(RoleController);

router.get('/', validate(taxonomyListSchema), roleController.getRoles);
router.get('/:id', validate(taxonomyGetSchema), roleController.getRoleById);
router.post('/', validate(taxonomyCreateSchema), roleController.createRole);
router.put('/:id', validate(taxonomyUpdateSchema), roleController.updateRole);
router.delete('/:id', validate(taxonomyDeleteSchema), roleController.deleteRole);

export default router;
