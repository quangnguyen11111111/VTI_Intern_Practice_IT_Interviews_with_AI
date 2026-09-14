import { injectable } from 'tsyringe';
import { IPaymentGateway } from './IPaymentGateway';

@injectable()
export class StripePaymentGateway implements IPaymentGateway {
  readonly provider = 'STRIPE' as const;

  private unsupported(): never {
    throw new Error('PAYMENT_PROVIDER_NOT_CONFIGURED');
  }

  createCheckout(
    _input: Parameters<IPaymentGateway['createCheckout']>[0],
  ): Promise<never> {
    return Promise.reject(this.unsupported());
  }

  verifyWebhook(
    _headers: Parameters<IPaymentGateway['verifyWebhook']>[0],
    _rawBody: string,
  ): Promise<never> {
    return Promise.reject(this.unsupported());
  }

  getPaymentStatus(_providerPaymentId: string): Promise<never> {
    return Promise.reject(this.unsupported());
  }
}