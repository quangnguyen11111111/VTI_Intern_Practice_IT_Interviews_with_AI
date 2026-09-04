import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi
} from 'vitest';

import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET =
    'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET =
    'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import User, { IUser } from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { generateAuthTokens } from '../src/utils/token';
import app from '../src/app';

describe('ADM-03: Admin Metrics Integration Tests', () => {
  let mongoReplSet: MongoMemoryReplSet;

  beforeAll(async () => {
    mongoReplSet = await MongoMemoryReplSet.create({
      replSet: { count: 1 }
    });

    const uri = mongoReplSet.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoReplSet.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await InterviewSessionModel.deleteMany({});
  });

  const createUser = async (
    overrides: Partial<IUser> = {}
  ) => {
    const passwordHash = await bcrypt.hash(
      'TestPassword123',
      10
    );

    return User.create({
      email: `user_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}@example.com`,
      passwordHash,
      fullName: 'Test User',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      authVersion: 0,
      credentialVersion: 0,
      ...overrides
    });
  };

  const getToken = (user: IUser) => {
    return generateAuthTokens(
      user._id.toString(),
      user.role
    ).accessToken;
  };

  describe('1. Authentication & RBAC', () => {
    it('1.1 Không có token → 401', async () => {
      const res = await request(app).get(
        '/api/v1/admin/metrics?from=2026-08-01T00:00:00Z&to=2026-09-01T00:00:00Z'
      );

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('1.2 Candidate gọi Admin Metrics → 403', async () => {
      const candidate = await createUser({
        role: 'CANDIDATE'
      });

      const token = getToken(candidate);

      const res = await request(app)
        .get(
          '/api/v1/admin/metrics?from=2026-08-01T00:00:00Z&to=2026-09-01T00:00:00Z'
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
    });

    it('1.3 Admin gọi Admin Metrics → 200', async () => {
      const admin = await createUser({
        role: 'ADMIN'
      });

      const token = getToken(admin);

      const res = await request(app)
        .get(
          '/api/v1/admin/metrics?from=2026-08-01T00:00:00Z&to=2026-09-01T00:00:00Z'
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('2. Date Range Validation', () => {
    let adminToken: string;

    beforeEach(async () => {
      const admin = await createUser({
        role: 'ADMIN'
      });

      adminToken = getToken(admin);
    });

    it('2.1 Thiếu from → 400', async () => {
      const res = await request(app)
        .get(
          '/api/v1/admin/metrics?to=2026-09-01T00:00:00Z'
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('2.2 Thiếu to → 400', async () => {
      const res = await request(app)
        .get(
          '/api/v1/admin/metrics?from=2026-08-01T00:00:00Z'
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('2.3 from >= to → 400', async () => {
      const res = await request(app)
        .get(
          '/api/v1/admin/metrics?from=2026-09-01T00:00:00Z&to=2026-08-01T00:00:00Z'
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('2.4 Ngày không hợp lệ → 400', async () => {
      const res = await request(app)
        .get(
          '/api/v1/admin/metrics?from=not-a-date&to=2026-09-01T00:00:00Z'
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Metrics Aggregation', () => {
    let adminToken: string;

    beforeEach(async () => {
      const admin = await createUser({
        role: 'ADMIN'
      });

      adminToken = getToken(admin);

      await createUser({
        role: 'CANDIDATE',
        status: 'ACTIVE'
      });

      await createUser({
        role: 'INTERVIEWER',
        status: 'ACTIVE'
      });

      await createUser({
        role: 'CANDIDATE',
        status: 'LOCKED'
      });

      await InterviewSessionModel.create([
        {
          userId: 'user-1',
          status: 'COMPLETED',
          setupData: {
            jobPosition: 'Backend Developer',
            level: 'Junior',
            techStacks: ['Node.js']
          },
          overallScore: 80,
          learningPath: [],
          metadata: {
            promptTokens: 100,
            candidatesTokens: 50,
            totalTokens: 150
          },
          createdAt: new Date('2026-08-10T10:00:00Z'),
          updatedAt: new Date('2026-08-10T10:00:00Z')
        },
        {
          userId: 'user-2',
          status: 'FAILED',
          setupData: {
            jobPosition: 'Frontend Developer',
            level: 'Junior',
            techStacks: ['React']
          },
          overallScore: null,
          learningPath: [],
          metadata: {
            promptTokens: 200,
            candidatesTokens: 80,
            totalTokens: 280
          },
          createdAt: new Date('2026-08-15T10:00:00Z'),
          updatedAt: new Date('2026-08-15T10:00:00Z')
        }
      ]);
    });

    it('3.1 Trả đúng cấu trúc và aggregation metrics', async () => {
      const res = await request(app)
        .get(
          '/api/v1/admin/metrics?from=2026-08-01T00:00:00Z&to=2026-09-01T00:00:00Z'
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      expect(res.body.data.users).toEqual({
        total: 4,
        active: 3,
        locked: 1,
        inactive: 0
      });

      expect(res.body.data.interviews).toEqual({
        total: 2,
        byStatus: {
          PENDING: 0,
          GENERATING: 0,
          IN_PROGRESS: 0,
          EVALUATING: 0,
          COMPLETED: 1,
          FAILED: 1
        },
        promptTokens: 300,
        candidatesTokens: 130,
        totalTokens: 430
      });
    });

    it('3.2 Interview ngoài date range không được tính', async () => {
      await InterviewSessionModel.create({
        userId: 'user-3',
        status: 'COMPLETED',
        setupData: {
          jobPosition: 'DevOps Engineer',
          level: 'Junior',
          techStacks: ['Docker']
        },
        overallScore: 90,
        learningPath: [],
        metadata: {
          promptTokens: 999,
          candidatesTokens: 999,
          totalTokens: 1998
        },
        createdAt: new Date('2026-09-15T10:00:00Z'),
        updatedAt: new Date('2026-09-15T10:00:00Z')
      });

      const res = await request(app)
        .get(
          '/api/v1/admin/metrics?from=2026-08-01T00:00:00Z&to=2026-09-01T00:00:00Z'
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      expect(res.body.data.interviews.total).toBe(2);
      expect(res.body.data.interviews.totalTokens).toBe(430);
    });
  });
});