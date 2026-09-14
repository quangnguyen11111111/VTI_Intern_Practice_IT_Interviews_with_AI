import { createHmac, timingSafeEqual } from 'node:crypto';
import { injectable, inject } from 'tsyringe';
import {
  IPaymentGateway,
  CreateCheckoutInput,
  CreateCheckoutResult,
  VerifiedWebhook,
  ProviderPaymentStatus,
} from './IPaymentGateway';
import { AppEnv } from '../../config/env';

@injectable()
export class MockPaymentGateway implements IPaymentGateway {
  readonly provider = 'MOCK' as const;

  private readonly sessions = new Map<
    string,
    CreateCheckoutResult
  >();

  constructor(@inject('AppEnv') private readonly env: AppEnv) {}

  async createCheckout(
    input: CreateCheckoutInput,
  ): Promise<CreateCheckoutResult> {
    const old = this.sessions.get(input.checkoutReference);

    if (old) {
      return old;
    }

    if (this.env.MOCK_PAYMENT_FAIL === 'true') {
      throw new Error('MOCK_GATEWAY_FAILED');
    }

    const result: CreateCheckoutResult = {
      provider: this.provider,
      providerPaymentId: `mock_${input.checkoutReference}`,
      checkoutUrl: `https://mock-payment.local/checkout/${encodeURIComponent(
        input.checkoutReference,
      )}`,
    };

    this.sessions.set(input.checkoutReference, result);

    return result;
  }

  async getPaymentStatus(
    providerPaymentId: string,
  ): Promise<ProviderPaymentStatus> {
    const configured = this.env.MOCK_PAYMENT_STATUS;

    return providerPaymentId.startsWith('mock_')
      ? configured
      : 'PENDING';
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
  ): Promise<VerifiedWebhook> {
    const signature = String(headers['x-mock-signature'] || '');

    const secret = this.env.PAYMENT_WEBHOOK_SECRET;

    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (
      signature.length !== expected.length ||
      !timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      )
    ) {
      throw new Error('INVALID_WEBHOOK_SIGNATURE');
    }

    const body = JSON.parse(rawBody) as Record<string, unknown>;

    if (
      body.status !== 'SUCCEEDED' &&
      body.status !== 'FAILED' &&
      body.status !== 'EXPIRED'
    ) {
      throw new Error('INVALID_WEBHOOK_STATUS');
    }

    if (!body.eventId || !body.eventType) {
      throw new Error('INVALID_WEBHOOK_EVENT');
    }

    return {
      provider: this.provider,
      eventId: String(body.eventId),
      eventType: String(body.eventType),
      paymentAttemptId: body.paymentAttemptId
        ? String(body.paymentAttemptId)
        : undefined,
      status: body.status,
      providerPaymentId: body.providerPaymentId
        ? String(body.providerPaymentId)
        : undefined,
      payload: body,
    };
  }
}