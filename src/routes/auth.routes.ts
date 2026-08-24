import { Router } from 'express';
import {
  registerHandler,
  loginHandler,
  refreshTokenHandler,
  logoutHandler,
  lockUserHandler,
} from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  lockUserSchema,
} from '../validators/auth.validator';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';
import { catchAsync } from '../utils/catchAsync';

const router = Router();

router.post('/register', validate(registerSchema), catchAsync(registerHandler));
router.post('/login', validate(loginSchema), catchAsync(loginHandler));
router.post('/refresh', validate(refreshTokenSchema), catchAsync(refreshTokenHandler));
router.post('/logout', validate(logoutSchema), catchAsync(logoutHandler));
router.patch('/users/:id/lock', authenticate, requireAdmin, validate(lockUserSchema), catchAsync(lockUserHandler));
router.patch('/lock/:id', authenticate, requireAdmin, validate(lockUserSchema), catchAsync(lockUserHandler));

export default router;
