import { injectable } from 'tsyringe';
import mongoose, { ClientSession } from 'mongoose';

import PaymentEvent, {
  IPaymentEvent,
} from '../models/payment-event.model';
import { IPaymentEventRepository } from './interfaces/IPaymentEventRepository';
import { PaymentProvider } from '../services/payment/IPaymentGateway';

@injectable()
export class PaymentEventRepository
  implements IPaymentEventRepository
{
  findByProviderEvent(
    provider: PaymentProvider,
    eventId: string,
    session?: ClientSession,
  ): Promise<IPaymentEvent | null> {
    return PaymentEvent.findOne({
      provider: provider as IPaymentEvent['provider'],
      eventId,
    }).session(session ?? null);
  }

  async create(
    data: Partial<IPaymentEvent>,
    session?: ClientSession,
  ): Promise<IPaymentEvent> {
    if (!session) {
      return PaymentEvent.create(data);
    }

    const event = new PaymentEvent(data);

    await event.save({ session });

    return event;
  }

  claim(id: string): Promise<IPaymentEvent | null> {
    return PaymentEvent.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        status: {
          $in: ['RECEIVED', 'FAILED'],
        },
      },
      {
        $set: {
          status: 'PROCESSING',
          processedAt: null,
        },
      },
      {
        returnDocument: 'after',
      },
    );
  }

  async markProcessed(
    id: string,
    status: 'PROCESSED' | 'IGNORED',
    session?: ClientSession,
  ): Promise<void> {
    await PaymentEvent.updateOne(
      {
        _id: new mongoose.Types.ObjectId(id),
      },
      {
        $set: {
          status,
          processedAt: new Date(),
        },
      },
      {
        session,
      },
    );
  }

  async markFailed(id: string): Promise<void> {
    await PaymentEvent.updateOne(
      {
        _id: new mongoose.Types.ObjectId(id),
        status: 'PROCESSING',
      },
      {
        $set: {
          status: 'FAILED',
        },
      },
    );
  }
}