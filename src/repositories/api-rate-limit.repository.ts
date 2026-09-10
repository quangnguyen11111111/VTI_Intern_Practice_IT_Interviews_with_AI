import { injectable } from 'tsyringe';

import { ApiRateLimitModel } from '../models/api-rate-limit.model';

import {
  IApiRateLimitRepository,
  RateLimitConsumeResult,
} from './interfaces/IApiRateLimitRepository';

@injectable()
export class ApiRateLimitRepository
  implements IApiRateLimitRepository
{
  async consume(
    keyPrefix: string,
    limit: number,
    windowMs: number,
    now: Date = new Date()
  ): Promise<RateLimitConsumeResult> {
    if (limit < 1) {
      throw new Error('Rate limit must be greater than zero');
    }

    if (windowMs < 1) {
      throw new Error('Rate limit window must be greater than zero');
    }

    const windowStartMs =
      Math.floor(now.getTime() / windowMs) * windowMs;

    const expiresAt = new Date(
      windowStartMs + windowMs
    );

    const key = `${keyPrefix}:${windowStartMs}`;

    const retryAfterSeconds = Math.max(
      Math.ceil(
        (expiresAt.getTime() - now.getTime()) / 1000
      ),
      1
    );

    /*
     * Atomic consume with upsert.
     *
     * Existing window:
     *   count < limit -> increment
     *   count >= limit -> no update
     *
     * First request:
     *   create document with count = 1
     */
    try {
      const updated =
        await ApiRateLimitModel.findOneAndUpdate(
          {
            key,
            count: {
              $lt: limit,
            },
          },
          {
            $inc: {
              count: 1,
            },
            $set: {
              expiresAt,
            },
            $setOnInsert: {
              key,
            },
          },
          {
            upsert: true,
            returnDocument: 'after',
          }
        );

      if (updated) {
        return {
          allowed: updated.count <= limit,
          count: updated.count,
          limit,
          retryAfterSeconds,
        };
      }
    } catch (error: any) {
      /*
       * Several requests may attempt to create the same
       * first window simultaneously. MongoDB's unique key
       * allows only one insert to succeed.
       *
       * The losing request retries against the document
       * that now exists.
       */
      if (error?.code !== 11000) {
        throw error;
      }
    }

    /*
     * Retry the atomic increment after a concurrent insert.
     */
    const retried =
      await ApiRateLimitModel.findOneAndUpdate(
        {
          key,
          count: {
            $lt: limit,
          },
        },
        {
          $inc: {
            count: 1,
          },
          $set: {
            expiresAt,
          },
        },
        {
          returnDocument: 'after',
        }
      );

    if (retried) {
      return {
        allowed: true,
        count: retried.count,
        limit,
        retryAfterSeconds,
      };
    }

    /*
     * No update means the limit has already been reached.
     */
    const current =
      await ApiRateLimitModel.findOne({ key });

    return {
      allowed: false,
      count: current?.count ?? limit,
      limit,
      retryAfterSeconds,
    };
  }
}