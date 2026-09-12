export interface InterviewQuotaReservationResult {
  reserved: boolean;
  alreadyExists: boolean;
  used: number;
  limit: number;
}

export interface InterviewQuotaCommitResult {
  committed: boolean;
  alreadyCommitted: boolean;
}

export interface IInterviewQuotaRepository {
  reserve(
    userId: string,
    quotaDate: string,
    timezone: string,
    limit: number,
    idempotencyKey: string
  ): Promise<InterviewQuotaReservationResult>;

  commit(
    userId: string,
    quotaDate: string,
    idempotencyKey: string
  ): Promise<InterviewQuotaCommitResult>;

  release(
    userId: string,
    quotaDate: string,
    idempotencyKey: string
  ): Promise<boolean>;
}