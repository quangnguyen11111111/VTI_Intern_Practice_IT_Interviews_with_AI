import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import express, { Request, Response, Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Hoist test environment variables before any module is evaluated
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import User, { IUser } from '../src/models/user.model';
import { generateAuthTokens } from '../src/utils/token';
import {
  authenticate,
  authorize,
  requireAdmin,
  requireOwnership,
  OwnerResolver,
  OwnerResolverResult,
} from '../src/middlewares/auth.middleware';
import { AppError } from '../src/utils/AppError';
import { globalErrorHandler } from '../src/middlewares/error.middleware';
import app from '../src/app';

// Mock resource schema strictly for testing ownership middleware isolation
interface ITestResource extends mongoose.Document {
  title: string;
  userId: mongoose.Types.ObjectId;
  content: string;
}

const TestResourceSchema = new mongoose.Schema<ITestResource>(
  {
    title: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
  },
  { timestamps: true }
);

const TestResource =
  mongoose.models.TestResource ||
  mongoose.model<ITestResource>('TestResource', TestResourceSchema);

// Build test app with identical error handling and middleware pipeline
const testApp = express();
testApp.use(express.json());

const testRouter = Router();

// Strict Production-style Resolver Contract: returns { ownerId, resource } or null
const resolveTestResource: OwnerResolver<ITestResource> = async (req: Request) => {
  const { id } = req.params;
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new AppError('ID tài nguyên không đúng định dạng ObjectId', 400, 'VALIDATION_ERROR');
  }
  const resource = await TestResource.findById(id);
  if (!resource) return null;
  return {
    ownerId: resource.userId,
    resource,
  };
};

// Owner-only route (GET)
testRouter.get(
  '/resources/:id',
  authenticate,
  requireOwnership(resolveTestResource, { resourceName: 'Hồ sơ' }),
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Lấy tài nguyên thành công',
      data: res.locals.resource,
    });
  }
);

// Owner-only route (PUT)
testRouter.put(
  '/resources/:id',
  authenticate,
  requireOwnership(resolveTestResource, { resourceName: 'Hồ sơ' }),
  async (req: Request, res: Response) => {
    const resource = res.locals.resource as ITestResource;
    const updated = await TestResource.findOneAndUpdate(
      { _id: resource._id, userId: req.user!._id },
      { title: req.body.title || resource.title, content: req.body.content || resource.content },
      { returnDocument: 'after' }
    );
    res.status(200).json({
      success: true,
      message: 'Cập nhật tài nguyên thành công',
      data: updated,
    });
  }
);

// Admin-bypassable route (GET)
testRouter.get(
  '/admin-bypassable-resources/:id',
  authenticate,
  requireOwnership(resolveTestResource, { allowRoles: ['ADMIN'], resourceName: 'Hồ sơ' }),
  (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      message: 'Lấy tài nguyên thành công (admin bypass)',
      data: res.locals.resource,
    });
  }
);

// Generic authorize('ADMIN')
testRouter.get(
  '/admin-generic',
  authenticate,
  authorize('ADMIN'),
  (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'Admin generic authorized' });
  }
);

// requireAdmin route
testRouter.get(
  '/admin-require',
  authenticate,
  requireAdmin,
  (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'requireAdmin authorized' });
  }
);

// Multi-role route (CANDIDATE, INTERVIEWER)
testRouter.get(
  '/candidate-or-interviewer',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'Candidate or interviewer authorized' });
  }
);

// Dynamic resolver for testing strict contract violations & canonicalization
let dynamicResolverResponse: unknown = null;

const dynamicResolver: OwnerResolver = async () => {
  return dynamicResolverResponse as OwnerResolverResult;
};

testRouter.get(
  '/dynamic-resolver-resource',
  authenticate,
  requireOwnership(dynamicResolver),
  (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'Dynamic handler reached' });
  }
);

testRouter.get(
  '/dynamic-admin-bypass-resource',
  authenticate,
  requireOwnership(dynamicResolver, { allowRoles: ['ADMIN'] }),
  (_req: Request, res: Response) => {
    res.status(200).json({ success: true, message: 'Dynamic admin bypass handler reached' });
  }
);

testApp.use('/api/test', testRouter);
testApp.use(globalErrorHandler);

let mongoReplSet: MongoMemoryReplSet;

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongoReplSet.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await TestResource.deleteMany({});
  dynamicResolverResponse = null;
});

describe('AIP-17: Authorization Integration Tests (JWT Guard, RBAC & Ownership)', () => {
  // Helper to create test user
  const createUser = async (overrides: Partial<IUser> = {}) => {
    const passwordHash = await bcrypt.hash('TestPassword123', 10);
    return User.create({
      email: `user_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash,
      fullName: 'Test User',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      authVersion: 0,
      ...overrides,
    });
  };

  // =================================================================
  // 1. JWT GUARD TESTS
  // =================================================================
  describe('1. JWT Guard (Authentication)', () => {
    it('1.1 Không có Authorization header → 401 AUTH_UNAUTHORIZED', async () => {
      const res = await request(testApp).get('/api/test/admin-generic');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
      expect(res.body.message).toBe('Không tìm thấy access token xác thực');
    });

    it('1.2 Bearer token malformed (không đúng định dạng JWT) → 401 AUTH_UNAUTHORIZED', async () => {
      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', 'Bearer invalid.malformed.token');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
      expect(res.body.message).toBe('Access token không hợp lệ hoặc đã hết hạn');
    });

    it('1.2a Authorization header chỉ có tiền tố Bearer không kèm token → 401 AUTH_UNAUTHORIZED', async () => {
      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', 'Bearer ');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
      expect(res.body.message).toBe('Không tìm thấy access token xác thực');
    });

    it('1.3 Token hết hạn → 401 AUTH_UNAUTHORIZED', async () => {
      const user = await createUser();
      const expiredToken = jwt.sign(
        { sub: user._id.toString(), role: user.role, type: 'access' },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
      expect(res.body.message).toBe('Access token không hợp lệ hoặc đã hết hạn');
    });

    it('1.4 Refresh token dùng như access token → 401 AUTH_UNAUTHORIZED (sai type và sai secret)', async () => {
      const user = await createUser();
      const tokens = generateAuthTokens(user._id.toString(), user.role);

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${tokens.refreshToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('1.4a Token ký với JWT_ACCESS_SECRET nhưng type là refresh → 401 AUTH_UNAUTHORIZED', async () => {
      const user = await createUser();
      const forgedRefreshToken = jwt.sign(
        { sub: user._id.toString(), role: user.role, type: 'refresh' },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${forgedRefreshToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('1.5 Access token có malformed sub (không phải ObjectId) → 401 AUTH_UNAUTHORIZED, không thành 500', async () => {
      const malformedSubToken = jwt.sign(
        { sub: 'invalid-non-hex-object-id', role: 'ADMIN', type: 'access' },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${malformedSubToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
      expect(res.body.message).toBe('Access token không hợp lệ');
    });

    it('1.6 User không tồn tại trong DB → 401 AUTH_UNAUTHORIZED', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      const token = jwt.sign(
        { sub: nonExistentId, role: 'CANDIDATE', type: 'access' },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256', expiresIn: '15m' }
      );

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
      expect(res.body.message).toBe('Người dùng không tồn tại');
    });

    it('1.7 User có trạng thái INACTIVE → 401 AUTH_UNAUTHORIZED', async () => {
      const inactiveUser = await createUser({ status: 'INACTIVE' });
      const token = generateAuthTokens(inactiveUser._id.toString(), inactiveUser.role).accessToken;

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
      expect(res.body.message).toBe('Tài khoản không hoạt động');
    });

    it('1.8 User có trạng thái LOCKED → 403 AUTH_ACCOUNT_LOCKED', async () => {
      const lockedUser = await createUser({ status: 'LOCKED' });
      const token = generateAuthTokens(lockedUser._id.toString(), lockedUser.role).accessToken;

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_ACCOUNT_LOCKED');
      expect(res.body.message).toBe('Tài khoản đã bị khóa');
    });
  });

  // =================================================================
  // 2. RBAC TESTS
  // =================================================================
  describe('2. Role-Based Access Control (RBAC)', () => {
    it('2.1 Candidate gọi Admin route → 403 AUTH_FORBIDDEN', async () => {
      const candidate = await createUser({ role: 'CANDIDATE' });
      const token = generateAuthTokens(candidate._id.toString(), 'CANDIDATE').accessToken;

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
      expect(res.body.message).toBe('Bạn không có quyền thực hiện hành động này');
    });

    it('2.2 Admin gọi Admin route → 200 thành công', async () => {
      const admin = await createUser({ role: 'ADMIN' });
      const token = generateAuthTokens(admin._id.toString(), 'ADMIN').accessToken;

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Admin generic authorized');
    });

    it('2.3 JWT claim ADMIN nhưng role trong DB đã đổi thành CANDIDATE → 403 AUTH_FORBIDDEN', async () => {
      const user = await createUser({ role: 'ADMIN' });
      const tokenWithAdminClaim = generateAuthTokens(user._id.toString(), 'ADMIN').accessToken;

      // Demote user in database
      await User.findByIdAndUpdate(user._id, { role: 'CANDIDATE' });

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${tokenWithAdminClaim}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
    });

    it('2.4 JWT claim CANDIDATE nhưng role trong DB đã được thăng chức thành ADMIN → 200 thành công dựa trên DB live state', async () => {
      const user = await createUser({ role: 'CANDIDATE' });
      const tokenWithCandidateClaim = generateAuthTokens(user._id.toString(), 'CANDIDATE').accessToken;

      // Promote user in database
      await User.findByIdAndUpdate(user._id, { role: 'ADMIN' });

      const res = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${tokenWithCandidateClaim}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('2.5 requireAdmin và generic authorize("ADMIN") giữ behavior hoàn toàn nhất quán', async () => {
      const candidate = await createUser({ role: 'CANDIDATE' });
      const admin = await createUser({ role: 'ADMIN' });

      const candidateToken = generateAuthTokens(candidate._id.toString(), 'CANDIDATE').accessToken;
      const adminToken = generateAuthTokens(admin._id.toString(), 'ADMIN').accessToken;

      // Test candidate on both
      const genericCandidateRes = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${candidateToken}`);
      const requireCandidateRes = await request(testApp)
        .get('/api/test/admin-require')
        .set('Authorization', `Bearer ${candidateToken}`);

      expect(genericCandidateRes.status).toBe(403);
      expect(requireCandidateRes.status).toBe(403);
      expect(genericCandidateRes.body.code).toBe(requireCandidateRes.body.code);

      // Test admin on both
      const genericAdminRes = await request(testApp)
        .get('/api/test/admin-generic')
        .set('Authorization', `Bearer ${adminToken}`);
      const requireAdminRes = await request(testApp)
        .get('/api/test/admin-require')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(genericAdminRes.status).toBe(200);
      expect(requireAdminRes.status).toBe(200);
    });

    it('2.6 Multi-role route authorize("CANDIDATE", "INTERVIEWER") cho phép cả CANDIDATE và INTERVIEWER nhưng từ chối ADMIN nếu ADMIN không nằm trong danh sách role cho phép', async () => {
      const candidate = await createUser({ role: 'CANDIDATE' });
      const interviewer = await createUser({ role: 'INTERVIEWER' });
      const admin = await createUser({ role: 'ADMIN' });

      const candidateToken = generateAuthTokens(candidate._id.toString(), 'CANDIDATE').accessToken;
      const interviewerToken = generateAuthTokens(interviewer._id.toString(), 'INTERVIEWER').accessToken;
      const adminToken = generateAuthTokens(admin._id.toString(), 'ADMIN').accessToken;

      const resCandidate = await request(testApp)
        .get('/api/test/candidate-or-interviewer')
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(resCandidate.status).toBe(200);

      const resInterviewer = await request(testApp)
        .get('/api/test/candidate-or-interviewer')
        .set('Authorization', `Bearer ${interviewerToken}`);
      expect(resInterviewer.status).toBe(200);

      const resAdmin = await request(testApp)
        .get('/api/test/candidate-or-interviewer')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(403);
      expect(resAdmin.body.code).toBe('AUTH_FORBIDDEN');
    });

    it('2.7 Production Lock Routes được bảo vệ bởi authenticate và requireAdmin', async () => {
      const candidate = await createUser({ role: 'CANDIDATE' });
      const admin = await createUser({ role: 'ADMIN' });
      const targetUser = await createUser({ role: 'CANDIDATE' });

      const candidateToken = generateAuthTokens(candidate._id.toString(), 'CANDIDATE').accessToken;
      const adminToken = generateAuthTokens(admin._id.toString(), 'ADMIN').accessToken;

      // Candidate forbidden on PATCH /api/v1/auth/users/:id/lock
      const candidateLockRes = await request(app)
        .patch(`/api/v1/auth/users/${targetUser._id}/lock`)
        .set('Authorization', `Bearer ${candidateToken}`);
      expect(candidateLockRes.status).toBe(403);
      expect(candidateLockRes.body.code).toBe('AUTH_FORBIDDEN');

      // Admin authorized on PATCH /api/v1/auth/users/:id/lock
      const adminLockRes = await request(app)
        .patch(`/api/v1/auth/users/${targetUser._id}/lock`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminLockRes.status).toBe(200);
      expect(adminLockRes.body.data.user.status).toBe('LOCKED');
    });
  });

  // =================================================================
  // 3. OWNERSHIP GUARD TESTS
  // =================================================================
  describe('3. Ownership Guard (Resource Ownership & IDOR Protection)', () => {
    let userA: IUser;
    let userB: IUser;
    let admin: IUser;
    let tokenA: string;
    let tokenB: string;
    let adminToken: string;
    let resourceA: ITestResource;
    let resourceB: ITestResource;

    beforeEach(async () => {
      userA = await createUser({ fullName: 'User A' });
      userB = await createUser({ fullName: 'User B' });
      admin = await createUser({ fullName: 'Admin User', role: 'ADMIN' });

      tokenA = generateAuthTokens(userA._id.toString(), 'CANDIDATE').accessToken;
      tokenB = generateAuthTokens(userB._id.toString(), 'CANDIDATE').accessToken;
      adminToken = generateAuthTokens(admin._id.toString(), 'ADMIN').accessToken;

      resourceA = await TestResource.create({
        title: 'Resource of User A',
        userId: userA._id,
        content: 'Confidential content of A',
      });

      resourceB = await TestResource.create({
        title: 'Resource of User B',
        userId: userB._id,
        content: 'Confidential content of B',
      });
    });

    it('3.1 User A đọc resource của chính mình → 200 thành công', async () => {
      const res = await request(testApp)
        .get(`/api/test/resources/${resourceA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(resourceA._id.toString());
      expect(res.body.data.title).toBe('Resource of User A');
    });

    it('3.2 User A sửa resource của chính mình → 200 thành công', async () => {
      const res = await request(testApp)
        .put(`/api/test/resources/${resourceA._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Updated Title by A', content: 'Updated content' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Updated Title by A');

      // Verify DB change
      const dbResource = await TestResource.findById(resourceA._id);
      expect(dbResource?.title).toBe('Updated Title by A');
    });

    it('3.3 User A đọc resource của User B (IDOR Attempt) → 403 AUTH_FORBIDDEN', async () => {
      const res = await request(testApp)
        .get(`/api/test/resources/${resourceB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
      expect(res.body.message).toBe('Bạn không có quyền truy cập tài nguyên này');
    });

    it('3.4 User A sửa resource của User B (IDOR Mutation Attempt) → 403 AUTH_FORBIDDEN và DB không bị thay đổi', async () => {
      const res = await request(testApp)
        .put(`/api/test/resources/${resourceB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Hacked Title', content: 'Hacked content' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');

      // Verify DB untouched
      const dbResource = await TestResource.findById(resourceB._id);
      expect(dbResource?.title).toBe('Resource of User B');
      expect(dbResource?.content).toBe('Confidential content of B');
    });

    it('3.5 Forged ownerId/userId trong body không bypass được ownership', async () => {
      // User A attempts to update User B resource by placing userA._id in body
      const res = await request(testApp)
        .put(`/api/test/resources/${resourceB._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Tampered Title',
          userId: userA._id.toString(),
          ownerId: userA._id.toString(),
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');

      const dbResource = await TestResource.findById(resourceB._id);
      expect(dbResource?.title).toBe('Resource of User B');
      expect(dbResource?.userId.toString()).toBe(userB._id.toString());
    });

    it('3.6 Resource không tồn tại trong DB → 404 NOT_FOUND theo convention', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const res = await request(testApp)
        .get(`/api/test/resources/${nonExistentId}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
      expect(res.body.message).toBe('Hồ sơ không tồn tại');
    });

    it('3.7 Malformed resource ID trong params → 400 VALIDATION_ERROR, không thành 500 CastError', async () => {
      const res = await request(testApp)
        .get('/api/test/resources/not-a-valid-mongodb-object-id')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.message).toBe('ID tài nguyên không đúng định dạng ObjectId');
    });

    it('3.8 Admin bypass thành công ở route cấu hình rõ ràng allowRoles: ["ADMIN"]', async () => {
      // Admin reads User A resource via admin-bypassable route
      const res = await request(testApp)
        .get(`/api/test/admin-bypassable-resources/${resourceA._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Lấy tài nguyên thành công (admin bypass)');
      expect(res.body.data._id).toBe(resourceA._id.toString());
    });

    it('3.8a Admin bypass chỉ chạy sau khi resource được tìm thấy (resource không tồn tại trả 404)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const res = await request(testApp)
        .get(`/api/test/admin-bypassable-resources/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('3.9 Admin không bypass được route owner-only (không có allowRoles: ["ADMIN"])', async () => {
      // Admin attempts to read User A resource on owner-only route
      const res = await request(testApp)
        .get(`/api/test/resources/${resourceA._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
      expect(res.body.message).toBe('Bạn không có quyền truy cập tài nguyên này');
    });

    it('3.10 Ownership resolver gắn resource vào res.locals và req.resource ngăn chặn double-querying và TOCTOU drift', async () => {
      let localsResourceInHandler: ITestResource | null = null;
      let reqResourceInHandler: unknown = null;

      const inspectionRouter = Router();
      inspectionRouter.get(
        '/inspect/:id',
        authenticate,
        requireOwnership(resolveTestResource),
        (req: Request, res: Response) => {
          localsResourceInHandler = res.locals.resource as ITestResource;
          reqResourceInHandler = req.resource;
          res.status(200).json({ success: true });
        }
      );

      const inspectionApp = express();
      inspectionApp.use(express.json());
      inspectionApp.use('/api/inspect-test', inspectionRouter);
      inspectionApp.use(globalErrorHandler);

      const res = await request(inspectionApp)
        .get(`/api/inspect-test/inspect/${resourceA._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(localsResourceInHandler).toBeDefined();
      expect(localsResourceInHandler?._id.toString()).toBe(resourceA._id.toString());
      expect(reqResourceInHandler).toBeDefined();
      expect(
        reqResourceInHandler &&
          typeof reqResourceInHandler === 'object' &&
          '_id' in reqResourceInHandler &&
          String((reqResourceInHandler as { _id: unknown })._id)
      ).toBe(resourceA._id.toString());
    });

    it('3.11 Fail-closed table-driven: resolver trả ownerId rỗng, null, undefined, number, object hoặc malformed string → 403 AUTH_FORBIDDEN', async () => {
      const invalidOwnerIdCases: Array<{ label: string; value: unknown }> = [
        { label: 'empty string', value: '' },
        { label: 'whitespace only', value: '   ' },
        { label: 'null', value: null },
        { label: 'undefined', value: undefined },
        { label: 'number', value: 12345 },
        { label: 'object', value: { someKey: 'someVal' } },
        { label: 'malformed non-empty string', value: 'not-an-object-id' },
      ];

      for (const tc of invalidOwnerIdCases) {
        dynamicResolverResponse = {
          ownerId: tc.value as string,
          resource: { title: `Resource with ${tc.label}` },
        };

        const res = await request(testApp)
          .get('/api/test/dynamic-resolver-resource')
          .set('Authorization', `Bearer ${tokenA}`);

        expect(res.status, `Failed on case: ${tc.label}`).toBe(403);
        expect(res.body.code, `Failed code on: ${tc.label}`).toBe('AUTH_FORBIDDEN');
        expect(res.body.message, `Failed message on: ${tc.label}`).toBe('Không thể xác định quyền sở hữu tài nguyên');
      }
    });

    it('3.12 Admin trên route allowRoles: ["ADMIN"] vẫn bị 403 AUTH_FORBIDDEN nếu resolver trả ownerId không hợp lệ', async () => {
      dynamicResolverResponse = {
        ownerId: 'invalid-non-hex-id',
        resource: { title: 'Resource with Invalid Owner' },
      };

      const res = await request(testApp)
        .get('/api/test/dynamic-admin-bypass-resource')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
      expect(res.body.message).toBe('Không thể xác định quyền sở hữu tài nguyên');
    });

    it('3.13 Canonicalization: ownerId là ObjectId string viết hoa của chính user vẫn được authorize thành công', async () => {
      const uppercaseOwnerId = userA._id.toHexString().toUpperCase();

      dynamicResolverResponse = {
        ownerId: uppercaseOwnerId,
        resource: { title: 'Uppercase Owner Resource' },
      };

      const res = await request(testApp)
        .get('/api/test/dynamic-resolver-resource')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Dynamic handler reached');
    });

    it('3.14 Không có fallback tự suy đoán ownerId từ userId, _id, id khi trả sai shape → 403 AUTH_FORBIDDEN', async () => {
      dynamicResolverResponse = {
        userId: new mongoose.Types.ObjectId(),
        _id: new mongoose.Types.ObjectId(),
      };

      const res = await request(testApp)
        .get('/api/test/dynamic-resolver-resource')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('AUTH_FORBIDDEN');
      expect(res.body.message).toBe('Không thể xác định quyền sở hữu tài nguyên');
    });
  });
});
