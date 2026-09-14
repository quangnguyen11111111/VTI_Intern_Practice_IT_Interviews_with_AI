import { ClientSession } from 'mongoose';
import {
  IPaymentAttempt,
  PaymentStatus,
} from '../../models/payment-attempt.model';

export interface IPaymentAttemptRepository {
  findById(
    id: string,
    session?: ClientSession,
  ): Promise<IPaymentAttempt | null>;

  findByIdempotency(
    userId: string,
    key: string,
  ): Promise<IPaymentAttempt | null>;

  create(data: Partial<IPaymentAttempt>): Promise<IPaymentAttempt>;

  updateCheckoutResult(
    id: string,
    providerPaymentId: string,
    checkoutUrl: string,
  ): Promise<IPaymentAttempt | null>;

  transitionStatus(
    id: string,
    from: PaymentStatus,
    to: PaymentStatus,
    failureCode?: string | null,
    session?: ClientSession,
  ): Promise<IPaymentAttempt | null>;
}