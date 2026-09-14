export type PaymentProvider = 'MOCK' | 'STRIPE' | 'VNPAY';

export type ProviderPaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED';

export interface CreateCheckoutInput {
  checkoutReference: string;
  idempotencyKey: string;
  paymentAttemptId: string;
  userId: string;
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
}

export interface CreateCheckoutResult {
  provider: PaymentProvider;
  providerPaymentId: string;
  checkoutUrl: string;
}

export interface VerifiedWebhook {
  provider: PaymentProvider;
  eventId: string;
  eventType: string;
  paymentAttemptId?: string;
  status: Exclude<ProviderPaymentStatus, 'PENDING'>;
  providerPaymentId?: string;
  payload: Record<string, unknown>;
}

export interface IPaymentGateway {
  readonly provider: PaymentProvider;

  createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult>;

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<VerifiedWebhook>;

  getPaymentStatus(
    providerPaymentId: string,
  ): Promise<ProviderPaymentStatus>;
}