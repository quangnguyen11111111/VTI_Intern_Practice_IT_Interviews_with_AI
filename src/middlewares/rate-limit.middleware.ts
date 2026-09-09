import {
  Request,
  Response,
  NextFunction
} from 'express';

import {
  inject,
  injectable
} from 'tsyringe';

import {
  IApiRateLimitRepository
} from '../repositories/interfaces/IApiRateLimitRepository';

import {
  AppError
} from '../utils/AppError';

export interface RateLimitOptions {
  keyPrefix: string;
  limit: number;
  windowMs: number;
  keyGenerator?: (
    req: Request
  ) => string;
}

const defaultKeyGenerator = (
  req: Request
): string => {
  return req.ip || 'unknown';
};

@injectable()
export class RateLimitMiddleware {
  constructor(
    @inject('IApiRateLimitRepository')
    private readonly repository:
      IApiRateLimitRepository
  ) {}

  create(
    options: RateLimitOptions
  ) {
    return async (
      req: Request,
      res: Response,
      next: NextFunction
    ): Promise<void> => {
      try {
        const keyGenerator =
          options.keyGenerator ??
          defaultKeyGenerator;

        const identity =
          keyGenerator(req);

        const keyPrefix =
          `${options.keyPrefix}:${identity}`;

        const result =
          await this.repository.consume(
            keyPrefix,
            options.limit,
            options.windowMs
          );

        const remaining =
          Math.max(
            result.limit - result.count,
            0
          );

        res.setHeader(
          'X-RateLimit-Limit',
          result.limit.toString()
        );

        res.setHeader(
          'X-RateLimit-Remaining',
          remaining.toString()
        );

        if (!result.allowed) {
          res.setHeader(
            'Retry-After',
            result.retryAfterSeconds.toString()
          );

          next(
            new AppError(
              'Too many requests. Please try again later.',
              429,
              'RATE_LIMIT_EXCEEDED'
            )
          );

          return;
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }
}