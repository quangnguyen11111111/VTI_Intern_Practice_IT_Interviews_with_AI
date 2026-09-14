import { Router } from 'express';

import { paymentController } from '../controllers/payment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { checkoutSchema } from '../validators/payment.validator';
import { catchAsync } from '../utils/catchAsync';

const r = Router();

r.post(
  '/checkout',
  authenticate,
  validate(checkoutSchema),
  catchAsync(paymentController.checkout),
);

r.get('/:id', authenticate, catchAsync(paymentController.get));

r.post('/webhook/mock', catchAsync(paymentController.webhook));

r.post('/webhook/:provider', catchAsync(paymentController.webhook));

export default r;