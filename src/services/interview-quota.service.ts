import {
  injectable,
  inject,
} from 'tsyringe';

import {
  IInterviewQuotaRepository,
} from '../repositories/interfaces/IInterviewQuotaRepository';

import {
  IInterviewQuotaService,
  InterviewQuotaResult,
} from './interfaces/IInterviewQuotaService';

import { getEnv } from '../config/env';

@injectable()
export class InterviewQuotaService
  implements IInterviewQuotaService
{
  constructor(
    @inject('IInterviewQuotaRepository')
    private readonly quotaRepository:
      IInterviewQuotaRepository
  ) {}

  async reserve(
    userId: string,
    idempotencyKey: string
  ): Promise<InterviewQuotaResult> {
    const env = getEnv();

    const limit =
      env.DAILY_INTERVIEW_QUOTA;

    const timezone =
      env.QUOTA_TIMEZONE;

    const quotaDate =
      this.getQuotaDate(
        new Date(),
        timezone
      );

    const result =
      await this.quotaRepository.reserve(
        userId,
        quotaDate,
        timezone,
        limit,
        idempotencyKey
      );

    return {
      ...result,
      quotaDate,
      remaining: Math.max(
        limit - result.used,
        0
      ),
    };
  }

  async commit(
    userId: string,
    quotaDate: string,
    idempotencyKey: string
  ): Promise<boolean> {
    const result =
      await this.quotaRepository.commit(
        userId,
        quotaDate,
        idempotencyKey
      );

    return (
      result.committed ||
      result.alreadyCommitted
    );
  }

  async release(
    userId: string,
    quotaDate: string,
    idempotencyKey: string
  ): Promise<boolean> {
    return this.quotaRepository.release(
      userId,
      quotaDate,
      idempotencyKey
    );
  }

  private getQuotaDate(
    date: Date,
    timeZone: string
  ): string {
    const formatter =
      new Intl.DateTimeFormat(
        'en-CA',
        {
          timeZone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }
      );

    return formatter.format(date);
  }
}