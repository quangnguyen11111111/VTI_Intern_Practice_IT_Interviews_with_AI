import { Router } from 'express';
import { registerHandler, loginHandler } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema } from '../validators/auth.validator';
import { catchAsync } from '../utils/catchAsync';

const router = Router();

router.post('/register', validate(registerSchema), catchAsync(registerHandler));
router.post('/login', validate(loginSchema), catchAsync(loginHandler));

export default router;
