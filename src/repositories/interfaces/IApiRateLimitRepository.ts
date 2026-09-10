export interface RateLimitConsumeResult {
  allowed: boolean;
  count: number;
  limit: number;
  retryAfterSeconds: number;
}

export interface IApiRateLimitRepository {
  consume(
    keyPrefix: string,
    limit: number,
    windowMs: number,
    now?: Date
  ): Promise<RateLimitConsumeResult>;
}