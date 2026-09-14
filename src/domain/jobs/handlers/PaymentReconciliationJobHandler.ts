import { injectable, inject } from 'tsyringe';

import { randomUUID } from 'node:crypto';

import { IPaymentService } from '../../../services/interfaces/IPaymentService';

import { IJobHandler } from '../IJobHandler';

@injectable()
export class PaymentReconciliationJobHandler
  implements IJobHandler<{ requestId?: string }>
{
  readonly name = 'PAYMENT_RECONCILIATION';

  constructor(
    @inject('IPaymentService') private readonly service: IPaymentService,
  ) {}

  async handle(data: { requestId?: string }) {
    await this.service.reconcilePending(data.requestId ?? randomUUID());
  }
}