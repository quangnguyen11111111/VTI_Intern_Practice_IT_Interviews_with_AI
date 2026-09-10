export interface InterviewQuotaResult {
  reserved: boolean;
  alreadyExists: boolean;
  used: number;
  limit: number;
  remaining: number;
  quotaDate: string;
}

export interface IInterviewQuotaService {
  reserve(
    userId: string,
    idempotencyKey: string
  ): Promise<InterviewQuotaResult>;

  commit(
    userId: string,
    quotaDate: string,
    idempotencyKey: string
  ): Promise<boolean>;

  release(
    userId: string,
    quotaDate: string,
    idempotencyKey: string
  ): Promise<boolean>;
}