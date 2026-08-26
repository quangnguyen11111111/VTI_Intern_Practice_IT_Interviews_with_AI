import { Router } from 'express';
import roleRoutes from './role.route';
import levelRoutes from './level.route';
import technologyRoutes from './technology.route';
import interviewRoutes from './interview.route';
import authRoutes from './auth.routes';
import profileRoutes from './profile.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/roles', roleRoutes);
router.use('/levels', levelRoutes);
router.use('/technologies', technologyRoutes);
router.use('/interviews', interviewRoutes);

export default router;