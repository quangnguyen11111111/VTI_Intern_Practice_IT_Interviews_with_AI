import { ClientSession } from 'mongoose';
import { IPaymentEvent } from '../../models/payment-event.model';

export interface IPaymentEventRepository {
  findByProviderEvent(
    provider: string,
    eventId: string,
    session?: ClientSession,
  ): Promise<IPaymentEvent | null>;

  create(
    data: Partial<IPaymentEvent>,
    session?: ClientSession,
  ): Promise<IPaymentEvent>;

  claim(id: string): Promise<IPaymentEvent | null>;

  markProcessed(
    id: string,
    status: 'PROCESSED' | 'IGNORED',
    session?: ClientSession,
  ): Promise<void>;

  markFailed(id: string): Promise<void>;
}