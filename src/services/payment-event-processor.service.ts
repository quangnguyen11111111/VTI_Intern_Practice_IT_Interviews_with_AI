import { inject, injectable } from 'tsyringe';
import mongoose from 'mongoose';
import { createHash } from 'node:crypto';

import { IPaymentAttemptRepository } from '../repositories/interfaces/IPaymentAttemptRepository';
import { IPlanRepository } from '../repositories/interfaces/IPlanRepository';
import { ISubscriptionRepository } from '../repositories/interfaces/ISubscriptionRepository';
import { IEntitlementRepository } from '../repositories/interfaces/IEntitlementRepository';
import { IPaymentEventRepository } from '../repositories/interfaces/IPaymentEventRepository';
import { IAuditService } from './interfaces/IAuditService';
import { VerifiedWebhook } from './payment/IPaymentGateway';
import { AppError } from '../utils/AppError';

const ENTITLEMENT_KEY = 'PREMIUM_INTERVIEW_ACCESS';

const EVENT_WAIT_ATTEMPTS = 100;
const EVENT_WAIT_MS = 50;

const TRANSACTION_RETRY_ATTEMPTS = 3;

const sanitizePayload = (
  value: Record<string, unknown>,
): Record<string, unknown> => {
  const sensitive =
    /^(pan|card(number)?|cvv|cvc|security(code)?|password|token|secret|authorization)$/i;

  const walk = (input: unknown, depth = 0): unknown => {
    if (depth > 4) return '[TRUNCATED]';

    if (Array.isArray(input)) {
      return input
        .slice(0, 50)
        .map((item) => walk(item, depth + 1));
    }

    if (!input || typeof input !== 'object') {
      return input;
    }

    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .slice(0, 100)
        .map(([key, item]) => [
          key,
          sensitive.test(key)
            ? '[REDACTED]'
            : walk(item, depth + 1),
        ]),
    );
  };

  const sanitized = walk(value);
  const serialized = JSON.stringify(sanitized);

  if (serialized.length <= 32_768) {
    return sanitized as Record<string, unknown>;
  }

  return {
    truncated: true,
    payloadHash: createHash('sha256')
      .update(serialized)
      .digest('hex'),
  };
};

const isDuplicateKey = (error: unknown): boolean =>
  (error as { code?: number } | null)?.code === 11000;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

@injectable()
export class PaymentEventProcessor {
  constructor(
    @inject('IPaymentAttemptRepository')
    private readonly attempts: IPaymentAttemptRepository,

    @inject('IPlanRepository')
    private readonly plans: IPlanRepository,

    @inject('ISubscriptionRepository')
    private readonly subscriptions: ISubscriptionRepository,

    @inject('IEntitlementRepository')
    private readonly entitlements: IEntitlementRepository,

    @inject('IPaymentEventRepository')
    private readonly events: IPaymentEventRepository,

    @inject('IAuditService')
    private readonly audit: IAuditService,
  ) {}

  private async getOrCreateEvent(
    event: VerifiedWebhook,
  ): Promise<
    NonNullable<
      Awaited<
        ReturnType<
          IPaymentEventRepository['findByProviderEvent']
        >
      >
    >
  > {
    let eventDoc = await this.events.findByProviderEvent(
      event.provider,
      event.eventId,
    );

    if (!eventDoc) {
      try {
        eventDoc = await this.events.create({
          provider: event.provider,
          eventId: event.eventId,
          eventType: event.eventType,
          paymentAttemptId: event.paymentAttemptId
            ? new mongoose.Types.ObjectId(event.paymentAttemptId)
            : null,
          payloadHash: createHash('sha256')
            .update(JSON.stringify(event.payload))
            .digest('hex'),
          payload: sanitizePayload(event.payload),
          status: 'RECEIVED',
        });
      } catch (error) {
        if (!isDuplicateKey(error)) {
          throw error;
        }

        eventDoc = await this.events.findByProviderEvent(
          event.provider,
          event.eventId,
        );
      }
    }

    if (!eventDoc) {
      throw new AppError(
        'Payment event unavailable',
        503,
        'PAYMENT_EVENT_UNAVAILABLE',
      );
    }

    return eventDoc;
  }

  private async claimOrWait(
    event: VerifiedWebhook,
    eventId: string,
  ) {
    for (
      let attempt = 0;
      attempt < EVENT_WAIT_ATTEMPTS;
      attempt += 1
    ) {
      const claimed = await this.events.claim(eventId);

      if (claimed) {
        return {
          eventDoc: claimed,
          claimed: true,
        };
      }

      const current = await this.events.findByProviderEvent(
        event.provider,
        event.eventId,
      );

      if (!current) {
        throw new AppError(
          'Payment event unavailable',
          503,
          'PAYMENT_EVENT_UNAVAILABLE',
        );
      }

      if (
        current.status === 'PROCESSED' ||
        current.status === 'IGNORED'
      ) {
        return {
          eventDoc: current,
          claimed: false,
        };
      }

      await sleep(EVENT_WAIT_MS);
    }

    throw new AppError(
      'Payment event is already being processed',
      409,
      'PAYMENT_EVENT_PROCESSING',
    );
  }

  private async processClaimedEvent(
    event: VerifiedWebhook,
    eventDocId: string,
    requestId: string,
  ) {
    let actorId: string | undefined;
    let entitlementId: string | undefined;

    let terminalStatus: 'PROCESSED' | 'IGNORED' = 'PROCESSED';

    for (
      let transactionAttempt = 1;
      transactionAttempt <= TRANSACTION_RETRY_ATTEMPTS;
      transactionAttempt += 1
    ) {
      const session = await mongoose.startSession();

      try {
        const transactionStatus = await session.withTransaction(
          async (): Promise<'PROCESSED' | 'IGNORED'> => {
            if (
              !event.paymentAttemptId ||
              !mongoose.isValidObjectId(event.paymentAttemptId)
            ) {
              throw new AppError(
                'Payment attempt missing',
                400,
                'PAYMENT_ATTEMPT_MISSING',
              );
            }

            const attempt = await this.attempts.findById(
              event.paymentAttemptId,
              session,
            );

            if (!attempt) {
              throw new AppError(
                'Payment not found',
                404,
                'PAYMENT_NOT_FOUND',
              );
            }

            actorId = attempt.userId.toString();

            if (attempt.provider !== event.provider) {
              throw new AppError(
                'Provider mismatch',
                409,
                'PAYMENT_PROVIDER_MISMATCH',
              );
            }

            if (
              attempt.providerPaymentId &&
              event.providerPaymentId &&
              attempt.providerPaymentId !==
                event.providerPaymentId
            ) {
              throw new AppError(
                'Provider payment mismatch',
                409,
                'PAYMENT_PROVIDER_MISMATCH',
              );
            }

            if (attempt.status !== 'PENDING') {
              await this.events.markProcessed(
                eventDocId,
                'IGNORED',
                session,
              );

              return 'IGNORED';
            }

            await this.attempts.transitionStatus(
              attempt._id.toString(),
              'PENDING',
              event.status,
              undefined,
              session,
            );

            if (event.status === 'SUCCEEDED') {
              const plan = await this.plans.findById(
                attempt.planId.toString(),
                session,
              );

              if (!plan) {
                throw new AppError(
                  'Plan not found',
                  404,
                  'PAYMENT_PLAN_NOT_FOUND',
                );
              }

              const now = new Date();

              const subscription =
                await this.subscriptions.createOrExtendActive(
                  attempt.userId.toString(),
                  attempt.planId.toString(),
                  plan.durationDays,
                  now,
                  session,
                );

              if (!subscription) {
                throw new AppError(
                  'Subscription update failed',
                  409,
                  'PAYMENT_SUBSCRIPTION_UPDATE_FAILED',
                );
              }

              const entitlement =
                await this.entitlements.createOrExtendActive(
                  attempt.userId.toString(),
                  ENTITLEMENT_KEY,
                  subscription._id,
                  subscription.expiresAt!,
                  now,
                  session,
                );

              if (!entitlement) {
                throw new AppError(
                  'Entitlement update failed',
                  409,
                  'PAYMENT_ENTITLEMENT_UPDATE_FAILED',
                );
              }

              entitlementId = entitlement._id.toString();
            }

            await this.events.markProcessed(
              eventDocId,
              'PROCESSED',
              session,
            );

            return 'PROCESSED';
          },
        );

        terminalStatus = transactionStatus;
        break;
      } catch (error) {
        if (
          isDuplicateKey(error) &&
          transactionAttempt < TRANSACTION_RETRY_ATTEMPTS
        ) {
          await sleep(50 * transactionAttempt);
          continue;
        }

        await this.events
          .markFailed(eventDocId)
          .catch(() => undefined);

        throw error;
      } finally {
        await session.endSession();
      }
    }

    if (actorId) {
      await this.audit.createAuditLog({
        actorId,
        targetId: event.paymentAttemptId,
        targetType: 'PAYMENT_ATTEMPT',
        resourceType: 'PAYMENT_ATTEMPT',
        action: 'PAYMENT_STATE_CHANGED',
        outcome: 'SUCCESS',
        requestId,
      });

      await this.audit.createAuditLog({
        actorId,
        targetId: eventDocId,
        targetType: 'PAYMENT_EVENT',
        resourceType: 'PAYMENT_EVENT',
        action: 'PAYMENT_WEBHOOK_PROCESSED',
        outcome: 'SUCCESS',
        requestId,
      });

      if (event.status === 'SUCCEEDED' && entitlementId) {
        await this.audit.createAuditLog({
          actorId,
          targetId: entitlementId,
          targetType: 'ENTITLEMENT',
          resourceType: 'ENTITLEMENT',
          action: 'ENTITLEMENT_CHANGED',
          outcome: 'SUCCESS',
          requestId,
        });
      }
    }

    return {
      eventId: event.eventId,
      status:
        terminalStatus === 'IGNORED'
          ? 'IGNORED'
          : event.status,
    };
  }

  async process(
    event: VerifiedWebhook,
    requestId: string,
  ) {
    const eventDoc = await this.getOrCreateEvent(event);

    if (
      eventDoc.status === 'PROCESSED' ||
      eventDoc.status === 'IGNORED'
    ) {
      return {
        eventId: event.eventId,
        status: eventDoc.status,
      };
    }

    const claimed = await this.claimOrWait(
      event,
      eventDoc._id.toString(),
    );

    if (!claimed.claimed) {
      return {
        eventId: event.eventId,
        status:
          claimed.eventDoc.status === 'PROCESSED'
            ? 'PROCESSED'
            : 'IGNORED',
      };
    }

    return this.processClaimedEvent(
      event,
      eventDoc._id.toString(),
      requestId,
    );
  }
}