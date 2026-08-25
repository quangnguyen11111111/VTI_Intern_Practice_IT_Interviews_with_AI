import { Router } from 'express';

import roleRoutes from './role.route';
import levelRoutes from './level.route';
import technologyRoutes from './technology.route';
import adminUserRoutes from './admin-user.route';

const router = Router();

router.use('/roles', roleRoutes);
router.use('/levels', levelRoutes);
router.use('/technologies', technologyRoutes);
router.use('/admin', adminUserRoutes);

export default router;