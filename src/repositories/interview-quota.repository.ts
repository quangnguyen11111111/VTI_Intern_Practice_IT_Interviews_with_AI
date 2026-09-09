import { injectable } from 'tsyringe';

import { InterviewQuotaModel } from '../models/interview-quota.model';

import {
  IInterviewQuotaRepository,
  InterviewQuotaCommitResult,
  InterviewQuotaReservationResult,
} from './interfaces/IInterviewQuotaRepository';

@injectable()
export class InterviewQuotaRepository
  implements IInterviewQuotaRepository
{
  async reserve(
    userId: string,
    quotaDate: string,
    timezone: string,
    limit: number,
    idempotencyKey: string
  ): Promise<InterviewQuotaReservationResult> {
    if (limit < 1) {
      throw new Error(
        'Interview quota limit must be greater than zero'
      );
    }

    /*
     * Ensure exactly one quota document exists
     * for each user and calendar day.
     */
    try {
      await InterviewQuotaModel.updateOne(
        {
          userId,
          quotaDate,
        },
        {
          $setOnInsert: {
            userId,
            quotaDate,
            timezone,
            used: 0,
            reservations: [],
          },
        },
        {
          upsert: true,
        }
      );
    } catch (error: any) {
      /*
       * Another concurrent request may have created
       * the same user/day document first.
       */
      if (error?.code !== 11000) {
        throw error;
      }
    }

    /*
     * Idempotent retry:
     *
     * If the same action was already reserved or committed,
     * never consume another quota slot.
     */
    const existing =
      await InterviewQuotaModel.findOne({
        userId,
        quotaDate,
        'reservations.key': idempotencyKey,
      });

    if (existing) {
      return {
        reserved: false,
        alreadyExists: true,
        used: existing.used,
        limit,
      };
    }

    /*
     * Atomic reservation:
     *
     * MongoDB checks:
     *   used < limit
     *   idempotency key does not exist
     *
     * and increments used + inserts reservation atomically.
     */
    const updated =
      await InterviewQuotaModel.findOneAndUpdate(
        {
          userId,
          quotaDate,
          used: {
            $lt: limit,
          },
          'reservations.key': {
            $ne: idempotencyKey,
          },
        },
        {
          $inc: {
            used: 1,
          },
          $push: {
            reservations: {
              key: idempotencyKey,
              status: 'RESERVED',
              createdAt: new Date(),
            },
          },
          $set: {
            timezone,
          },
        },
        {
          returnDocument: 'after',
        }
      );

    if (updated) {
      return {
        reserved: true,
        alreadyExists: false,
        used: updated.used,
        limit,
      };
    }

    /*
     * The atomic update failed.
     * Inspect the current document to distinguish:
     *   - idempotent retry
     *   - quota exhausted
     */
    const current =
      await InterviewQuotaModel.findOne({
        userId,
        quotaDate,
      });

    if (!current) {
      throw new Error(
        'INTERVIEW_QUOTA_NOT_FOUND'
      );
    }

    const alreadyExists =
      current.reservations.some(
        (reservation) =>
          reservation.key === idempotencyKey
      );

    return {
      reserved: false,
      alreadyExists,
      used: current.used,
      limit,
    };
  }

  async commit(
    userId: string,
    quotaDate: string,
    idempotencyKey: string
  ): Promise<InterviewQuotaCommitResult> {
    /*
     * Only RESERVED reservations can become COMMITTED.
     */
    const updated =
      await InterviewQuotaModel.findOneAndUpdate(
        {
          userId,
          quotaDate,
          reservations: {
            $elemMatch: {
              key: idempotencyKey,
              status: 'RESERVED',
            },
          },
        },
        {
          $set: {
            'reservations.$[reservation].status':
              'COMMITTED',
          },
        },
        {
          arrayFilters: [
            {
              'reservation.key':
                idempotencyKey,
              'reservation.status':
                'RESERVED',
            },
          ],
          returnDocument: 'after',
        }
      );

    if (updated) {
      return {
        committed: true,
        alreadyCommitted: false,
      };
    }

    /*
     * If no RESERVED reservation exists, check whether
     * the action was already committed by a previous attempt.
     */
    const current =
      await InterviewQuotaModel.findOne({
        userId,
        quotaDate,
      });

    if (!current) {
      return {
        committed: false,
        alreadyCommitted: false,
      };
    }

    const alreadyCommitted =
      current.reservations.some(
        (reservation) =>
          reservation.key === idempotencyKey &&
          reservation.status === 'COMMITTED'
      );

    return {
      committed: false,
      alreadyCommitted,
    };
  }

  async release(
    userId: string,
    quotaDate: string,
    idempotencyKey: string
  ): Promise<boolean> {
    /*
     * Only RESERVED reservations can be released.
     * A COMMITTED quota entry can never be refunded
     * accidentally by this method.
     */
    const updated =
      await InterviewQuotaModel.findOneAndUpdate(
        {
          userId,
          quotaDate,
          reservations: {
            $elemMatch: {
              key: idempotencyKey,
              status: 'RESERVED',
            },
          },
          used: {
            $gt: 0,
          },
        },
        {
          $inc: {
            used: -1,
          },
          $pull: {
            reservations: {
              key: idempotencyKey,
              status: 'RESERVED',
            },
          },
        },
        {
          returnDocument: 'after',
        }
      );

    return Boolean(updated);
  }
}