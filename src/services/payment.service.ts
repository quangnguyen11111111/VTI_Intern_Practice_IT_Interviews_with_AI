import { inject, injectable } from 'tsyringe';
import mongoose from 'mongoose';
import { IPaymentService } from './interfaces/IPaymentService';
import { IPlanRepository } from '../repositories/interfaces/IPlanRepository';
import { IPaymentAttemptRepository } from '../repositories/interfaces/IPaymentAttemptRepository';
import { IPaymentGateway } from './payment/IPaymentGateway';
import { PaymentEventProcessor } from './payment-event-processor.service';
import { IAuditService } from './interfaces/IAuditService';
import { AppError } from '../utils/AppError';
import PaymentAttempt from '../models/payment-attempt.model';

@injectable()
export class PaymentService implements IPaymentService {
  constructor(
    @inject('IPlanRepository')
    private readonly plans: IPlanRepository,

    @inject('IPaymentAttemptRepository')
    private readonly attempts: IPaymentAttemptRepository,

    @inject('IPaymentGateway')
    private readonly gateway: IPaymentGateway,

    @inject('IAuditService')
    private readonly audit: IAuditService,

    @inject(PaymentEventProcessor)
    private readonly eventProcessor: PaymentEventProcessor,
  ) {}

  private out(a: any) {
    return {
      id: a._id.toString(),
      status: a.status,
      checkoutReference: a.checkoutReference,
      checkoutUrl: a.checkoutUrl ?? null,
      amount: a.amount,
      currency: a.currency,
      provider: a.provider,
      planId: a.planId.toString(),
    };
  }

  async createCheckout(
    userId: string,
    planCode: string,
    key: string,
    requestId: string,
  ) {
    const plan = await this.plans.findByCode(planCode);

    if (!plan) {
      throw new AppError(
        'Plan not found',
        404,
        'PAYMENT_PLAN_NOT_FOUND',
      );
    }

    if (plan.status !== 'ACTIVE') {
      throw new AppError(
        'Plan is inactive',
        400,
        'PAYMENT_PLAN_INACTIVE',
      );
    }

    const old = await this.attempts.findByIdempotency(userId, key);

    if (old) {
      if (String(old.planId) !== String(plan._id)) {
        throw new AppError(
          'Idempotency key was already used for another plan',
          409,
          'PAYMENT_IDEMPOTENCY_KEY_REUSED',
        );
      }

      if (!old.checkoutUrl) {
        throw new AppError(
          'Checkout is not ready',
          409,
          'PAYMENT_CHECKOUT_NOT_READY',
        );
      }

      return this.out(old);
    }

    const ref = `CHK-${new mongoose.Types.ObjectId()}`;

    let attempt;

    try {
      attempt = await this.attempts.create({
        userId: new mongoose.Types.ObjectId(userId),
        planId: plan._id,
        idempotencyKey: key,
        checkoutReference: ref,
        provider: this.gateway.provider,
        amount: plan.price,
        currency: plan.currency,
        status: 'PENDING',
      });
    } catch (e: any) {
      if (e?.code === 11000) {
        const raced = await this.attempts.findByIdempotency(
          userId,
          key,
        );

        if (raced) {
          if (String(raced.planId) !== String(plan._id)) {
            throw new AppError(
              'Idempotency key was already used for another plan',
              409,
              'PAYMENT_IDEMPOTENCY_KEY_REUSED',
            );
          }

          if (!raced.checkoutUrl) {
            throw new AppError(
              'Checkout is not ready',
              409,
              'PAYMENT_CHECKOUT_NOT_READY',
            );
          }

          return this.out(raced);
        }
      }

      throw e;
    }

    try {
      const result = await this.gateway.createCheckout({
        checkoutReference: ref,
        idempotencyKey: key,
        paymentAttemptId: attempt._id.toString(),
        userId,
        amount: plan.price,
        currency: plan.currency,
        description: plan.name,
        metadata: {
          planCode,
        },
      });

      if (result.provider !== this.gateway.provider) {
        throw new AppError(
          'Payment provider mismatch',
          409,
          'PAYMENT_PROVIDER_MISMATCH',
        );
      }

      const saved = await this.attempts.updateCheckoutResult(
        attempt._id.toString(),
        result.providerPaymentId,
        result.checkoutUrl,
      );

      if (!saved) {
        throw new AppError(
          'Payment attempt changed',
          409,
          'PAYMENT_CONCURRENT_STATE_CHANGE',
        );
      }

      await this.audit.createAuditLog({
        actorId: userId,
        targetId: attempt._id.toString(),
        targetType: 'PAYMENT_ATTEMPT',
        resourceType: 'PAYMENT_ATTEMPT',
        action: 'PAYMENT_CHECKOUT_CREATED',
        outcome: 'SUCCESS',
        requestId,
      });

      return this.out(saved);
    } catch (e) {
      try {
        await this.attempts.transitionStatus(
          attempt._id.toString(),
          'PENDING',
          'FAILED',
          e instanceof AppError
            ? e.code
            : 'PAYMENT_CHECKOUT_FAILED',
        );
      } catch {}

      try {
        await this.audit.createAuditLog({
          actorId: userId,
          targetId: attempt._id.toString(),
          targetType: 'PAYMENT_ATTEMPT',
          resourceType: 'PAYMENT_ATTEMPT',
          action: 'PAYMENT_CHECKOUT_FAILED',
          outcome: 'FAILURE',
          requestId,
          reason:
            e instanceof AppError
              ? e.code
              : 'PAYMENT_CHECKOUT_FAILED',
        });
      } catch {}

      throw e;
    }
  }

  async getPayment(userId: string, id: string) {
    const a = await this.attempts.findById(id);

    if (!a) {
      throw new AppError(
        'Payment not found',
        404,
        'PAYMENT_NOT_FOUND',
      );
    }

    if (a.userId.toString() !== userId) {
      throw new AppError(
        'Access denied',
        403,
        'AUTH_FORBIDDEN',
      );
    }

    return this.out(a);
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string,
    requestId: string,
    expectedProvider?: string,
  ) {
    if (
      expectedProvider &&
      expectedProvider.toUpperCase() !== this.gateway.provider
    ) {
      throw new AppError(
        'Payment provider mismatch',
        409,
        'PAYMENT_PROVIDER_MISMATCH',
      );
    }

    let event;

    try {
      event = await this.gateway.verifyWebhook(
        headers,
        rawBody,
      );
    } catch {
      throw new AppError(
        'Invalid webhook signature',
        401,
        'PAYMENT_WEBHOOK_SIGNATURE_INVALID',
      );
    }

    if (event.provider !== this.gateway.provider) {
      throw new AppError(
        'Payment provider mismatch',
        409,
        'PAYMENT_PROVIDER_MISMATCH',
      );
    }

    return this.eventProcessor.process(event, requestId);
  }

  async reconcilePending(requestId: string) {
    const pending = await PaymentAttempt.find({
      status: 'PENDING',
      createdAt: {
        $lt: new Date(Date.now() - 5 * 60 * 1000),
      },
    })
      .select('_id userId provider providerPaymentId')
      .limit(100)
      .lean();

    let changed = 0;

    for (const attempt of pending) {
      if (
        !attempt.providerPaymentId ||
        attempt.provider !== this.gateway.provider
      ) {
        continue;
      }

      const status = await this.gateway.getPaymentStatus(
        attempt.providerPaymentId,
      );

      if (status === 'PENDING') {
        continue;
      }

      try {
        const event = {
          provider: this.gateway.provider,
          eventId: `reconcile_${attempt._id}_${status}`,
          eventType: 'RECONCILIATION',
          paymentAttemptId: attempt._id.toString(),
          status,
          providerPaymentId: attempt.providerPaymentId,
          payload: {
            source: 'reconciliation',
            paymentAttemptId: attempt._id.toString(),
            status,
            providerPaymentId: attempt.providerPaymentId,
          },
        } as const;

        await this.eventProcessor.process(
          event,
          requestId,
        );

        changed++;

        await this.audit.createAuditLog({
          actorId: attempt.userId.toString(),
          targetId: attempt._id.toString(),
          targetType: 'PAYMENT_ATTEMPT',
          resourceType: 'PAYMENT_ATTEMPT',
          action: 'PAYMENT_RECONCILED',
          outcome: 'SUCCESS',
          requestId,
        });
      } catch {}
    }

    return changed;
  }
}