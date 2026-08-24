import { Router } from 'express';
import { getProfileHandler, updateProfileHandler } from '../controllers/profile.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { updateProfileSchema } from '../validators/profile.validator';
import { catchAsync } from '../utils/catchAsync';

const router = Router();

router.get('/', authenticate, catchAsync(getProfileHandler));
router.patch('/', authenticate, validate(updateProfileSchema), catchAsync(updateProfileHandler));

export default router;
