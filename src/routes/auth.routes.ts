import { Router } from 'express';
import {
  registerHandler,
  loginHandler,
  googleAuthHandler,
  refreshTokenHandler,
  logoutHandler,
  lockUserHandler,
  changePasswordHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
} from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import {
  registerSchema,
  loginSchema,
  googleAuthSchema,
  refreshTokenSchema,
  logoutSchema,
  lockUserSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware';
import { catchAsync } from '../utils/catchAsync';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { container } from '../config/di';
import { getEnv } from '../config/env';

const router = Router();

const env = getEnv();
const rateLimitMiddleware = container.resolve(RateLimitMiddleware);

const loginRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'auth:login',
  limit: env.RATE_LIMIT_LOGIN_MAX,
  windowMs: env.RATE_LIMIT_LOGIN_WINDOW_MS,
});

const registerRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'auth:register',
  limit: env.RATE_LIMIT_REGISTER_MAX,
  windowMs: env.RATE_LIMIT_REGISTER_WINDOW_MS,
});

router.post('/register', registerRateLimit, validate(registerSchema), catchAsync(registerHandler));
router.post('/login', loginRateLimit, validate(loginSchema), catchAsync(loginHandler));
router.post('/google', loginRateLimit, validate(googleAuthSchema), catchAsync(googleAuthHandler));

router.post('/refresh', validate(refreshTokenSchema), catchAsync(refreshTokenHandler));
router.post('/logout', validate(logoutSchema), catchAsync(logoutHandler));

router.patch('/users/:id/lock', authenticate, requireAdmin, validate(lockUserSchema), catchAsync(lockUserHandler));
router.patch('/lock/:id', authenticate, requireAdmin, validate(lockUserSchema), catchAsync(lockUserHandler));

router.patch('/password', authenticate, validate(changePasswordSchema), catchAsync(changePasswordHandler));

router.post('/password/forgot', validate(forgotPasswordSchema), catchAsync(forgotPasswordHandler));

router.post('/password/reset', validate(resetPasswordSchema), catchAsync(resetPasswordHandler));

export default router;
