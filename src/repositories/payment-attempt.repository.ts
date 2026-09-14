import { injectable } from 'tsyringe';
import mongoose, { ClientSession } from 'mongoose';
import PaymentAttempt, {
  IPaymentAttempt,
  PaymentStatus,
} from '../models/payment-attempt.model';
import { IPaymentAttemptRepository } from './interfaces/IPaymentAttemptRepository';
import { AppError } from '../utils/AppError';

@injectable()
export class PaymentAttemptRepository implements IPaymentAttemptRepository {
  findById(
    id: string,
    session?: ClientSession,
  ): Promise<IPaymentAttempt | null> {
    return PaymentAttempt.findById(id).session(session ?? null);
  }

  findByIdempotency(
    userId: string,
    key: string,
  ): Promise<IPaymentAttempt | null> {
    return PaymentAttempt.findOne({
      userId,
      idempotencyKey: key,
    });
  }

  async create(data: Partial<IPaymentAttempt>): Promise<IPaymentAttempt> {
    return PaymentAttempt.create(data).then((x) => x);
  }

  async updateCheckoutResult(
    id: string,
    providerPaymentId: string,
    checkoutUrl: string,
  ): Promise<IPaymentAttempt | null> {
    return PaymentAttempt.findOneAndUpdate(
      {
        _id: id,
        status: 'PENDING',
      },
      {
        $set: {
          providerPaymentId,
          checkoutUrl,
        },
      },
      {
        returnDocument: 'after',
      },
    );
  }

  async transitionStatus(
    id: string,
    from: PaymentStatus,
    to: PaymentStatus,
    failureCode?: string | null,
    session?: ClientSession,
  ): Promise<IPaymentAttempt | null> {
    const allowed: Record<PaymentStatus, PaymentStatus[]> = {
      PENDING: ['SUCCEEDED', 'FAILED', 'EXPIRED'],
      SUCCEEDED: [],
      FAILED: [],
      EXPIRED: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new AppError(
        'Invalid payment state transition',
        409,
        'PAYMENT_INVALID_STATE_TRANSITION',
      );
    }

    const query = PaymentAttempt.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        status: from,
      },
      {
        $set: {
          status: to,
          ...(failureCode ? { failureCode } : {}),
        },
      },
      {
        returnDocument: 'after',
        session,
      },
    );

    const result = await query;

    if (!result) {
      throw new AppError(
        'Payment state changed concurrently',
        409,
        'PAYMENT_CONCURRENT_STATE_CHANGE',
      );
    }

    return result;
  }
}