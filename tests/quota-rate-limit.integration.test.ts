import 'reflect-metadata';

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';

import mongoose from 'mongoose';
import {
  MongoMemoryReplSet,
} from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';

import { container } from '../src/config/di';

import {
  IJobScheduler,
} from '../src/domain/jobs/IJobScheduler';

import User from '../src/models/user.model';
import RefreshToken from '../src/models/refresh-token.model';

import {
  ApiRateLimitModel,
} from '../src/models/api-rate-limit.model';

import {
  InterviewQuotaModel,
} from '../src/models/interview-quota.model';

import {
  InterviewQuotaRepository,
} from '../src/repositories/interview-quota.repository';

import {
  InterviewQuotaService,
} from '../src/services/interview-quota.service';

import {
  generateAuthTokens,
} from '../src/utils/token';

import {
  InterviewSessionModel,
} from '../src/models/InterviewSession';

import {
  SystemPromptModel,
} from '../src/models/system-prompt.model';

import {
  MockAiProvider,
} from '../src/services/ai/providers/MockAiProvider';

import {
  getEnv,
} from '../src/config/env';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';

  process.env.JWT_ACCESS_SECRET =
    'test_jwt_access_secret_key_at_least_32_characters_long_12345';

  process.env.JWT_REFRESH_SECRET =
    'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';

  process.env.JWT_ACCESS_EXPIRES_IN =
    '15m';

  process.env.JWT_REFRESH_EXPIRES_IN =
    '7d';

  process.env.BCRYPT_SALT_ROUNDS =
    '10';

  process.env.DAILY_INTERVIEW_QUOTA =
    '5';

  process.env.QUOTA_TIMEZONE =
    'Asia/Ho_Chi_Minh';

  process.env.RATE_LIMIT_LOGIN_MAX =
    '3';

  process.env.RATE_LIMIT_LOGIN_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_REGISTER_MAX =
    '2';

  process.env.RATE_LIMIT_REGISTER_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_CREATE_INTERVIEW_MAX =
    '10';

  process.env.RATE_LIMIT_CREATE_INTERVIEW_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_AI_MAX =
    '5';

  process.env.RATE_LIMIT_AI_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_SUBMIT_MAX =
    '10';

  process.env.RATE_LIMIT_SUBMIT_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_PROGRESS_MAX =
    '30';

  process.env.RATE_LIMIT_PROGRESS_WINDOW_MS =
    '60000';
});

class MockJobScheduler implements IJobScheduler {
  public enqueueCalls: Array<{
    jobName: string;
    data: unknown;
  }> = [];

  public shouldFail = false;

  async enqueue<T>(
    jobName: string,
    data: T
  ): Promise<void> {
    if (this.shouldFail) {
      throw new Error(
        'Mock scheduler enqueue failed'
      );
    }

    this.enqueueCalls.push({
      jobName,
      data,
    });
  }

  reset(): void {
    this.enqueueCalls = [];
    this.shouldFail = false;
  }
}

const mockJobScheduler =
  new MockJobScheduler();

container.register('IJobScheduler', {
  useValue: mockJobScheduler,
});

let app: typeof import('../src/app').default;

let mongoReplSet:
  MongoMemoryReplSet;

beforeAll(async () => {
  mongoReplSet =
    await MongoMemoryReplSet.create({
      replSet: {
        count: 1,
      },
    });

  await mongoose.connect(
    mongoReplSet.getUri()
  );

  /*
   * Import app only AFTER:
   * 1. reflect-metadata has loaded
   * 2. mock IJobScheduler has been registered
   * 3. MongoDB has been connected
   *
   * interview.route.ts resolves InterviewController
   * during module evaluation.
   */
  app =
    (await import('../src/app')).default;
});

afterAll(async () => {
  await new Promise((resolve) =>
    setTimeout(resolve, 100)
  );

  await mongoose.disconnect();
  await mongoReplSet.stop();
});

beforeEach(async () => {
  mockJobScheduler.reset();

  process.env.NODE_ENV = 'test';

  process.env.DAILY_INTERVIEW_QUOTA =
    '5';

  process.env.QUOTA_TIMEZONE =
    'Asia/Ho_Chi_Minh';

  process.env.RATE_LIMIT_LOGIN_MAX =
    '3';

  process.env.RATE_LIMIT_LOGIN_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_REGISTER_MAX =
    '2';

  process.env.RATE_LIMIT_REGISTER_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_CREATE_INTERVIEW_MAX =
    '10';

  process.env.RATE_LIMIT_CREATE_INTERVIEW_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_AI_MAX =
    '5';

  process.env.RATE_LIMIT_AI_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_SUBMIT_MAX =
    '10';

  process.env.RATE_LIMIT_SUBMIT_WINDOW_MS =
    '60000';

  process.env.RATE_LIMIT_PROGRESS_MAX =
    '30';

  process.env.RATE_LIMIT_PROGRESS_WINDOW_MS =
    '60000';

  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  await ApiRateLimitModel.deleteMany({});
  await InterviewQuotaModel.deleteMany({});
  await InterviewSessionModel.deleteMany({});
  await SystemPromptModel.deleteMany({});
});

const createCandidate = async (
  email: string
) => {
  const passwordHash =
    await bcrypt.hash(
      'Password123!',
      10
    );

  return User.create({
    email,
    passwordHash,
    fullName: 'QUO-01 Candidate',
    role: 'CANDIDATE',
    status: 'ACTIVE',
    credentialVersion: 0,
    authVersion: 0,
  });
};

const createPendingInterview = async (
  userId: string
) => {
  return InterviewSessionModel.create({
    userId,
    status: 'PENDING',
    setupData: {
      jobPosition:
        'Software Engineer',
      level: 'JUNIOR',
      techStacks: [
        'TypeScript',
      ],
    },
  });
};

/**
 * ADM-04 compatibility:
 * interview generation now requires a published
 * GENERATION system prompt in the test environment.
 */
const createPublishedGenerationPrompt =
  async (
    userId: mongoose.Types.ObjectId
  ) => {
    return SystemPromptModel.create({
      promptKey: 'interview',
      type: 'GENERATION',
      language: 'EN',
      version: 1,
      content:
        'Generate interview questions for the candidate.',
      status: 'PUBLISHED',
      createdBy: userId,
      publishedAt: new Date(),
    });
  };

describe(
  'QUO-01: Daily Quota & Technical Rate Limiting',
  () => {
    describe(
      'Environment configuration',
      () => {
        it(
          'loads QUO-01 limits from environment',
          () => {
            const env = getEnv();

            expect(
              env.DAILY_INTERVIEW_QUOTA
            ).toBe(5);

            expect(
              env.QUOTA_TIMEZONE
            ).toBe(
              'Asia/Ho_Chi_Minh'
            );

            expect(
              env.RATE_LIMIT_LOGIN_MAX
            ).toBe(3);

            expect(
              env.RATE_LIMIT_LOGIN_WINDOW_MS
            ).toBe(60000);

            expect(
              env.RATE_LIMIT_REGISTER_MAX
            ).toBe(2);

            expect(
              env.RATE_LIMIT_REGISTER_WINDOW_MS
            ).toBe(60000);
          }
        );

        it(
          'rejects invalid daily interview quota',
          () => {
            const original =
              process.env
                .DAILY_INTERVIEW_QUOTA;

            try {
              process.env.DAILY_INTERVIEW_QUOTA =
                '0';

              expect(() =>
                getEnv()
              ).toThrow(
                /DAILY_INTERVIEW_QUOTA/
              );

              process.env.DAILY_INTERVIEW_QUOTA =
                '-1';

              expect(() =>
                getEnv()
              ).toThrow(
                /DAILY_INTERVIEW_QUOTA/
              );
            } finally {
              if (
                original ===
                undefined
              ) {
                delete process.env
                  .DAILY_INTERVIEW_QUOTA;
              } else {
                process.env
                  .DAILY_INTERVIEW_QUOTA =
                  original;
              }
            }
          }
        );

        it(
          'rejects invalid rate-limit max values',
          () => {
            const original =
              process.env
                .RATE_LIMIT_LOGIN_MAX;

            try {
              process.env.RATE_LIMIT_LOGIN_MAX =
                '0';

              expect(() =>
                getEnv()
              ).toThrow(
                /RATE_LIMIT_LOGIN_MAX/
              );
            } finally {
              if (
                original ===
                undefined
              ) {
                delete process.env
                  .RATE_LIMIT_LOGIN_MAX;
              } else {
                process.env
                  .RATE_LIMIT_LOGIN_MAX =
                  original;
              }
            }
          }
        );

        it(
          'rejects invalid rate-limit window values',
          () => {
            const original =
              process.env
                .RATE_LIMIT_LOGIN_WINDOW_MS;

            try {
              process.env.RATE_LIMIT_LOGIN_WINDOW_MS =
                '500';

              expect(() =>
                getEnv()
              ).toThrow(
                /RATE_LIMIT_LOGIN_WINDOW_MS/
              );
            } finally {
              if (
                original ===
                undefined
              ) {
                delete process.env
                  .RATE_LIMIT_LOGIN_WINDOW_MS;
              } else {
                process.env
                  .RATE_LIMIT_LOGIN_WINDOW_MS =
                  original;
              }
            }
          }
        );
      }
    );

    describe(
      'POST /api/v1/auth/login',
      () => {
        it(
          'allows requests until the configured limit is reached',
          async () => {
            const responses = [];

            for (
              let index = 0;
              index <
              Number(
                process.env
                  .RATE_LIMIT_LOGIN_MAX
              );
              index += 1
            ) {
              const response =
                await request(app)
                  .post(
                    '/api/v1/auth/login'
                  )
                  .send({
                    email:
                      'missing@example.com',
                    password:
                      'WrongPassword123',
                  });

              responses.push(
                response
              );
            }

            expect(
              responses
            ).toHaveLength(3);

            for (
              const response of responses
            ) {
              expect(
                response.status
              ).not.toBe(429);

              expect(
                response.headers[
                  'x-ratelimit-limit'
                ]
              ).toBe('3');
            }
          }
        );

        it(
          'returns 429 after the configured login limit is exceeded',
          async () => {
            for (
              let index = 0;
              index < 3;
              index += 1
            ) {
              await request(app)
                .post(
                  '/api/v1/auth/login'
                )
                .send({
                  email:
                    'missing@example.com',
                  password:
                    'WrongPassword123',
                });
            }

            const response =
              await request(app)
                .post(
                  '/api/v1/auth/login'
                )
                .send({
                  email:
                    'missing@example.com',
                  password:
                    'WrongPassword123',
                });

            expect(
              response.status
            ).toBe(429);

            expect(
              response.body.success
            ).toBe(false);

            expect(
              response.body.code
            ).toBe(
              'RATE_LIMIT_EXCEEDED'
            );

            expect(
              response.headers[
                'retry-after'
              ]
            ).toBeDefined();

            expect(
              Number(
                response.headers[
                  'retry-after'
                ]
              )
            ).toBeGreaterThan(0);

            expect(
              response.headers[
                'x-ratelimit-limit'
              ]
            ).toBe('3');

            expect(
              response.headers[
                'x-ratelimit-remaining'
              ]
            ).toBe('0');
          }
        );

        it(
          'stores the login counter in MongoDB',
          async () => {
            await request(app)
              .post(
                '/api/v1/auth/login'
              )
              .send({
                email:
                  'missing@example.com',
                password:
                  'WrongPassword123',
              });

            const records =
              await ApiRateLimitModel.find(
                {}
              );

            expect(
              records
            ).toHaveLength(1);

            expect(
              records[0].count
            ).toBe(1);

            expect(
              records[0].key
            ).toContain(
              'auth:login:'
            );
          }
        );

        it(
          'counts requests before validation failures',
          async () => {
            const response =
              await request(app)
                .post(
                  '/api/v1/auth/login'
                )
                .send({});

            expect(
              response.status
            ).toBe(400);

            const records =
              await ApiRateLimitModel.find(
                {}
              );

            expect(
              records
            ).toHaveLength(1);

            expect(
              records[0].count
            ).toBe(1);
          }
        );
      }
    );

    describe(
      'POST /api/v1/auth/register',
      () => {
        it(
          'returns 429 after the configured register limit is exceeded',
          async () => {
            for (
              let index = 0;
              index < 2;
              index += 1
            ) {
              await request(app)
                .post(
                  '/api/v1/auth/register'
                )
                .send({
                  email:
                    `register-${index}@example.com`,
                  password:
                    'Password123!',
                  fullName:
                    `Register Test ${index}`,
                });
            }

            const response =
              await request(app)
                .post(
                  '/api/v1/auth/register'
                )
                .send({
                  email:
                    'register-3@example.com',
                  password:
                    'Password123!',
                  fullName:
                    'Register Test 3',
                });

            expect(
              response.status
            ).toBe(429);

            expect(
              response.body.success
            ).toBe(false);

            expect(
              response.body.code
            ).toBe(
              'RATE_LIMIT_EXCEEDED'
            );

            expect(
              response.headers[
                'retry-after'
              ]
            ).toBeDefined();
          }
        );

        it(
          'uses a separate counter from login',
          async () => {
            await request(app)
              .post(
                '/api/v1/auth/login'
              )
              .send({
                email:
                  'missing@example.com',
                password:
                  'WrongPassword123',
              });

            await request(app)
              .post(
                '/api/v1/auth/register'
              )
              .send({
                email:
                  'separate@example.com',
                password:
                  'Password123!',
                fullName:
                  'Separate Counter',
              });

            const records =
              await ApiRateLimitModel.find(
                {}
              );

            expect(
              records
            ).toHaveLength(2);

            const keys =
              records.map(
                (record) =>
                  record.key
              );

            expect(
              keys.some(
                (key) =>
                  key.startsWith(
                    'auth:login:'
                  )
              )
            ).toBe(true);

            expect(
              keys.some(
                (key) =>
                  key.startsWith(
                    'auth:register:'
                  )
              )
            ).toBe(true);
          }
        );
      }
    );

    describe(
      'Daily interview quota repository',
      () => {
        it(
          'allows exactly five reservations for one user/day',
          async () => {
            const repository =
              new InterviewQuotaRepository();

            const userId =
              '66b000000000000000000001';

            const quotaDate =
              '2026-09-08';

            const results = [];

            for (
              let index = 1;
              index <= 6;
              index += 1
            ) {
              results.push(
                await repository.reserve(
                  userId,
                  quotaDate,
                  'Asia/Ho_Chi_Minh',
                  5,
                  `interview:${index}:generate`
                )
              );
            }

            expect(
              results
                .slice(0, 5)
                .every(
                  (result) =>
                    result.reserved
                )
            ).toBe(true);

            expect(
              results[5].reserved
            ).toBe(false);

            const quota =
              await InterviewQuotaModel.findOne(
                {
                  userId,
                  quotaDate,
                }
              );

            expect(
              quota
            ).not.toBeNull();

            expect(
              quota?.used
            ).toBe(5);

            expect(
              quota?.reservations.length
            ).toBe(5);
          }
        );

        it(
          'does not consume quota twice for the same idempotency key',
          async () => {
            const repository =
              new InterviewQuotaRepository();

            const userId =
              '66b000000000000000000002';

            const quotaDate =
              '2026-09-08';

            const key =
              'interview:same-session:generate';

            const first =
              await repository.reserve(
                userId,
                quotaDate,
                'Asia/Ho_Chi_Minh',
                5,
                key
              );

            const second =
              await repository.reserve(
                userId,
                quotaDate,
                'Asia/Ho_Chi_Minh',
                5,
                key
              );

            expect(
              first.reserved
            ).toBe(true);

            expect(
              second.reserved
            ).toBe(false);

            expect(
              second.alreadyExists
            ).toBe(true);

            const quota =
              await InterviewQuotaModel.findOne(
                {
                  userId,
                  quotaDate,
                }
              );

            expect(
              quota?.used
            ).toBe(1);

            expect(
              quota?.reservations.length
            ).toBe(1);
          }
        );

        it(
          'commits a reservation and prevents it from being released',
          async () => {
            const repository =
              new InterviewQuotaRepository();

            const userId =
              '66b000000000000000000003';

            const quotaDate =
              '2026-09-08';

            const key =
              'interview:commit-session:generate';

            await repository.reserve(
              userId,
              quotaDate,
              'Asia/Ho_Chi_Minh',
              5,
              key
            );

            const committed =
              await repository.commit(
                userId,
                quotaDate,
                key
              );

            expect(
              committed.committed
            ).toBe(true);

            const released =
              await repository.release(
                userId,
                quotaDate,
                key
              );

            expect(
              released
            ).toBe(false);

            const quota =
              await InterviewQuotaModel.findOne(
                {
                  userId,
                  quotaDate,
                }
              );

            expect(
              quota?.used
            ).toBe(1);

            expect(
              quota?.reservations[0]
                .status
            ).toBe('COMMITTED');
          }
        );

        it(
          'releases a reservation when the downstream action fails',
          async () => {
            const repository =
              new InterviewQuotaRepository();

            const userId =
              '66b000000000000000000004';

            const quotaDate =
              '2026-09-08';

            const key =
              'interview:failed-session:generate';

            await repository.reserve(
              userId,
              quotaDate,
              'Asia/Ho_Chi_Minh',
              5,
              key
            );

            const released =
              await repository.release(
                userId,
                quotaDate,
                key
              );

            expect(
              released
            ).toBe(true);

            const quota =
              await InterviewQuotaModel.findOne(
                {
                  userId,
                  quotaDate,
                }
              );

            expect(
              quota?.used
            ).toBe(0);

            expect(
              quota?.reservations.length
            ).toBe(0);
          }
        );

        it(
          'does not exceed the quota with concurrent reservations',
          async () => {
            const repository =
              new InterviewQuotaRepository();

            const userId =
              '66b000000000000000000005';

            const quotaDate =
              '2026-09-08';

            const requests =
              Array.from(
                { length: 20 },
                (_, index) =>
                  repository.reserve(
                    userId,
                    quotaDate,
                    'Asia/Ho_Chi_Minh',
                    5,
                    `interview:concurrent-${index}:generate`
                  )
              );

            const results =
              await Promise.all(
                requests
              );

            const successful =
              results.filter(
                (result) =>
                  result.reserved
              );

            expect(
              successful
            ).toHaveLength(5);

            const quota =
              await InterviewQuotaModel.findOne(
                {
                  userId,
                  quotaDate,
                }
              );

            expect(
              quota?.used
            ).toBe(5);

            expect(
              quota?.reservations.length
            ).toBe(5);
          }
        );
      }
    );

    describe(
      'Daily interview quota service',
      () => {
        it(
          'calculates remaining quota correctly',
          async () => {
            const service =
              new InterviewQuotaService(
                new InterviewQuotaRepository()
              );

            const userId =
              '66b000000000000000000006';

            const first =
              await service.reserve(
                userId,
                'interview:service-1:generate'
              );

            expect(
              first.reserved
            ).toBe(true);

            expect(
              first.used
            ).toBe(1);

            expect(
              first.limit
            ).toBe(5);

            expect(
              first.remaining
            ).toBe(4);

            const second =
              await service.reserve(
                userId,
                'interview:service-2:generate'
              );

            expect(
              second.used
            ).toBe(2);

            expect(
              second.remaining
            ).toBe(3);
          }
        );

        it(
          'treats the same action as idempotent',
          async () => {
            const service =
              new InterviewQuotaService(
                new InterviewQuotaRepository()
              );

            const userId =
              '66b000000000000000000007';

            const key =
              'interview:idempotent-service:generate';

            const first =
              await service.reserve(
                userId,
                key
              );

            const retry =
              await service.reserve(
                userId,
                key
              );

            expect(
              first.reserved
            ).toBe(true);

            expect(
              retry.reserved
            ).toBe(false);

            expect(
              retry.alreadyExists
            ).toBe(true);

            expect(
              retry.used
            ).toBe(1);

            expect(
              retry.remaining
            ).toBe(4);
          }
        );
      }
    );

    describe(
      'POST /api/v1/interviews/:id/generate',
      () => {
        it(
          'rejects unauthenticated requests',
          async () => {
            const user =
              await createCandidate(
                'unauthenticated@example.com'
              );

            const interview =
              await createPendingInterview(
                user._id.toString()
              );

            const response =
              await request(app)
                .post(
                  `/api/v1/interviews/${interview._id}/generate`
                );

            expect(
              response.status
            ).toBe(401);
          }
        );

        it(
          'rejects a user who does not own the interview',
          async () => {
            const owner =
              await createCandidate(
                'owner@example.com'
              );

            const anotherUser =
              await createCandidate(
                'another@example.com'
              );

            const interview =
              await createPendingInterview(
                owner._id.toString()
              );

            const token =
              generateAuthTokens(
                anotherUser._id.toString(),
                anotherUser.role
              ).accessToken;

            const response =
              await request(app)
                .post(
                  `/api/v1/interviews/${interview._id}/generate`
                )
                .set(
                  'Authorization',
                  `Bearer ${token}`
                );

            expect(
              response.status
            ).toBe(403);

            expect(
              response.body.code
            ).toBe(
              'AUTH_FORBIDDEN'
            );

            expect(
              mockJobScheduler
                .enqueueCalls
            ).toHaveLength(0);
          }
        );

        it(
          'generates questions synchronously and commits one quota reservation',
          async () => {
            const user =
              await createCandidate(
                'generate@example.com'
              );

            await createPublishedGenerationPrompt(
              user._id
            );

            const interview =
              await createPendingInterview(
                user._id.toString()
              );

            const token =
              generateAuthTokens(
                user._id.toString(),
                user.role
              ).accessToken;

            const response =
              await request(app)
                .post(
                  `/api/v1/interviews/${interview._id}/generate`
                )
                .set(
                  'Authorization',
                  `Bearer ${token}`
                );

            expect(
              response.status
            ).toBe(200);

            const session =
              await InterviewSessionModel.findById(
                interview._id
              );

            expect(
              session?.status
            ).toBe('IN_PROGRESS');

            const quota =
              await InterviewQuotaModel.findOne(
                {
                  userId:
                    user._id.toString(),
                }
              );

            expect(
              quota?.used
            ).toBe(1);

            expect(
              quota?.reservations[0]
                .status
            ).toBe('COMMITTED');
          }
        );

        it(
          'returns 429 when daily quota is exhausted and does not enqueue another AI job',
          async () => {
            const user =
              await createCandidate(
                'quota@example.com'
              );

            const quotaRepository =
              new InterviewQuotaRepository();

            const quotaDate =
              new Intl.DateTimeFormat(
                'en-CA',
                {
                  timeZone:
                    'Asia/Ho_Chi_Minh',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                }
              ).format(
                new Date()
              );

            for (
              let index = 0;
              index < 5;
              index += 1
            ) {
              await quotaRepository.reserve(
                user._id.toString(),
                quotaDate,
                'Asia/Ho_Chi_Minh',
                5,
                `preload:${index}`
              );

              await quotaRepository.commit(
                user._id.toString(),
                quotaDate,
                `preload:${index}`
              );
            }

            const interview =
              await createPendingInterview(
                user._id.toString()
              );

            const token =
              generateAuthTokens(
                user._id.toString(),
                user.role
              ).accessToken;

            const response =
              await request(app)
                .post(
                  `/api/v1/interviews/${interview._id}/generate`
                )
                .set(
                  'Authorization',
                  `Bearer ${token}`
                );

            expect(
              response.status
            ).toBe(429);

            expect(
              response.body.code
            ).toBe(
              'QUOTA_EXCEEDED'
            );

            expect(
              mockJobScheduler
                .enqueueCalls
            ).toHaveLength(0);
          }
        );

        it(
          'does not consume quota twice for the same interview action',
          async () => {
            const user =
              await createCandidate(
                'idempotent@example.com'
              );

            await createPublishedGenerationPrompt(
              user._id
            );

            const interview =
              await createPendingInterview(
                user._id.toString()
              );

            const token =
              generateAuthTokens(
                user._id.toString(),
                user.role
              ).accessToken;

            const first =
              await request(app)
                .post(
                  `/api/v1/interviews/${interview._id}/generate`
                )
                .set(
                  'Authorization',
                  `Bearer ${token}`
                );

            expect(
              first.status
            ).toBe(200);

            const quotaAfterFirst =
              await InterviewQuotaModel.findOne(
                {
                  userId:
                    user._id.toString(),
                }
              );

            expect(
              quotaAfterFirst?.used
            ).toBe(1);

            const second =
              await request(app)
                .post(
                  `/api/v1/interviews/${interview._id}/generate`
                )
                .set(
                  'Authorization',
                  `Bearer ${token}`
                );

            expect(
              second.status
            ).toBe(400);

            const quotaAfterRetry =
              await InterviewQuotaModel.findOne(
                {
                  userId:
                    user._id.toString(),
                }
              );

            expect(
              quotaAfterRetry?.used
            ).toBe(1);

            const session =
              await InterviewSessionModel.findById(
                interview._id
              );

            expect(
              session?.status
            ).toBe('IN_PROGRESS');

            expect(
              mockJobScheduler
                .enqueueCalls
            ).toHaveLength(0);
          }
        );

        it(
          'releases quota when generation fails',
          async () => {
            const user =
              await createCandidate(
                'generation-fail@example.com'
              );

            await createPublishedGenerationPrompt(
              user._id
            );

            const interview =
              await createPendingInterview(
                user._id.toString()
              );

            const token =
              generateAuthTokens(
                user._id.toString(),
                user.role
              ).accessToken;

            const spy =
              vi.spyOn(
                MockAiProvider.prototype,
                'generateQuestions'
              ).mockRejectedValueOnce(
                new Error(
                  'Mock AI generation failed'
                )
              );

            try {
              const response =
                await request(app)
                  .post(
                    `/api/v1/interviews/${interview._id}/generate`
                  )
                  .set(
                    'Authorization',
                    `Bearer ${token}`
                  );

              expect(
                response.status
              ).toBe(500);

              const quota =
                await InterviewQuotaModel.findOne(
                  {
                    userId:
                      user._id.toString(),
                  }
                );

              expect(
                quota?.used
              ).toBe(0);

              expect(
                quota?.reservations.length
              ).toBe(0);
            } finally {
              spy.mockRestore();
            }
          }
        );
      }
    );
  }
);