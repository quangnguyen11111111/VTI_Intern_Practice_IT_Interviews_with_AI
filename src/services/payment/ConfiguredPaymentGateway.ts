import { inject, injectable } from 'tsyringe';
import { AppEnv } from '../../config/env';
import {
  IPaymentGateway,
  PaymentProvider,
  CreateCheckoutInput,
  CreateCheckoutResult,
  VerifiedWebhook,
  ProviderPaymentStatus,
} from './IPaymentGateway';
import { MockPaymentGateway } from './MockPaymentGateway';
import { StripePaymentGateway } from './StripePaymentGateway';
import { VnPayPaymentGateway } from './VnPayPaymentGateway';

@injectable()
export class ConfiguredPaymentGateway implements IPaymentGateway {
  private readonly delegate: IPaymentGateway;

  constructor(
    @inject('AppEnv') env: AppEnv,
    @inject('MockPaymentGateway') mock: MockPaymentGateway,
    @inject('StripePaymentGateway') stripe: StripePaymentGateway,
    @inject('VnPayPaymentGateway') vnpay: VnPayPaymentGateway,
  ) {
    const providers: Record<PaymentProvider, IPaymentGateway> = {
      MOCK: mock,
      STRIPE: stripe,
      VNPAY: vnpay,
    };

    this.delegate = providers[env.PAYMENT_PROVIDER];
  }

  get provider(): PaymentProvider {
    return this.delegate.provider;
  }

  createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    return this.delegate.createCheckout(input);
  }

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<VerifiedWebhook> {
    return this.delegate.verifyWebhook(headers, rawBody);
  }

  getPaymentStatus(
    providerPaymentId: string,
  ): Promise<ProviderPaymentStatus> {
    return this.delegate.getPaymentStatus(providerPaymentId);
  }
}