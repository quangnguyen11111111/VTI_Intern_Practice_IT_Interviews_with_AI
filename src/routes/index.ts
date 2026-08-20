import { Router } from 'express';
import roleRoutes from './role.route';
import levelRoutes from './level.route';
import technologyRoutes from './technology.route';

const router = Router();

router.use('/roles', roleRoutes);
router.use('/levels', levelRoutes);
router.use('/technologies', technologyRoutes);

export default router;
