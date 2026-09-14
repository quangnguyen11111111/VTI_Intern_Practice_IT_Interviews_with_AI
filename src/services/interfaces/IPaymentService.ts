export interface IPaymentService {
  createCheckout(
    userId: string,
    planCode: string,
    idempotencyKey: string,
    requestId: string,
  ): Promise<any>;

  handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    requestId: string,
    provider?: string,
  ): Promise<any>;

  getPayment(userId: string, id: string): Promise<any>;

  reconcilePending(requestId: string): Promise<number>;
}