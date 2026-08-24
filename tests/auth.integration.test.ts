import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
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

import app from '../src/app';
import User from '../src/models/user.model';
import { getEnv } from '../src/config/env';
import { generateAuthTokens, verifyAccessToken, verifyRefreshToken } from '../src/utils/token';
import { JwtTokenPayload } from '../src/types/auth.type';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Restore standard test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';

  await User.deleteMany({});
});

describe('AIP-15: Authentication Integration Tests', () => {
  // =================================================================
  // 1. CONFIGURATION & ENVIRONMENT VALIDATION TESTS
  // =================================================================
  describe('Environment Configuration Validation (getEnv)', () => {
    it('1.1 getEnv: Trả về config hợp lệ khi đầy đủ biến môi trường hợp lệ', () => {
      const config = getEnv();
      expect(config.JWT_ACCESS_SECRET).toBe('test_jwt_access_secret_key_at_least_32_characters_long_12345');
      expect(config.JWT_REFRESH_SECRET).toBe('test_jwt_refresh_secret_key_at_least_32_characters_long_67890');
      expect(config.JWT_ACCESS_EXPIRES_IN).toBe('15m');
      expect(config.JWT_REFRESH_EXPIRES_IN).toBe('7d');
      expect(config.BCRYPT_SALT_ROUNDS).toBe(10);
    });

    it('1.2 getEnv: Từ chối khi thiếu JWT_ACCESS_SECRET (không fallback)', () => {
      delete process.env.JWT_ACCESS_SECRET;
      expect(() => getEnv()).toThrow(/JWT_ACCESS_SECRET/);
    });

    it('1.3 getEnv: Từ chối khi thiếu JWT_REFRESH_SECRET (không fallback)', () => {
      delete process.env.JWT_REFRESH_SECRET;
      expect(() => getEnv()).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('1.4 getEnv: Từ chối khi JWT_ACCESS_SECRET ngắn hơn 32 ký tự', () => {
      process.env.JWT_ACCESS_SECRET = 'short-secret';
      expect(() => getEnv()).toThrow(/at least 32 characters/);
    });

    it('1.5 getEnv: Từ chối khi hai secret giống nhau', () => {
      const sameSecret = 'same_secret_key_with_at_least_32_characters_long_123456789';
      process.env.JWT_ACCESS_SECRET = sameSecret;
      process.env.JWT_REFRESH_SECRET = sameSecret;
      expect(() => getEnv()).toThrow(/must be different/);
    });

    it('1.6 getEnv: Từ chối khi JWT expiration không hợp lệ', () => {
      process.env.JWT_ACCESS_EXPIRES_IN = 'invalid_duration';
      expect(() => getEnv()).toThrow(/JWT_ACCESS_EXPIRES_IN/);
    });

    it('1.7 getEnv: Từ chối khi BCRYPT_SALT_ROUNDS ngoài phạm vi an toàn (10-14)', () => {
      process.env.BCRYPT_SALT_ROUNDS = '30';
      expect(() => getEnv()).toThrow(/BCRYPT_SALT_ROUNDS/);

      process.env.BCRYPT_SALT_ROUNDS = '5';
      expect(() => getEnv()).toThrow(/BCRYPT_SALT_ROUNDS/);
    });

    it('1.8 getEnv: Từ chối placeholder secret trong môi trường production', () => {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'replace-with-at-least-32-random-characters';
      process.env.JWT_REFRESH_SECRET = 'a_valid_production_refresh_secret_at_least_32_chars';
      expect(() => getEnv()).toThrow(/placeholder/);
    });
  });

  // =================================================================
  // 2. JWT TOKEN GENERATION & VERIFICATION TESTS
  // =================================================================
  describe('JWT Token Utilities (src/utils/token.ts)', () => {
    it('2.1 verifyAccessToken xác thực thành công access token với HS256', () => {
      const tokens = generateAuthTokens('user-123', 'CANDIDATE');
      const payload = verifyAccessToken(tokens.accessToken);

      expect(payload.sub).toBe('user-123');
      expect(payload.role).toBe('CANDIDATE');
      expect(payload.type).toBe('access');
    });

    it('2.2 verifyRefreshToken xác thực thành công refresh token với HS256', () => {
      const tokens = generateAuthTokens('user-123', 'ADMIN');
      const payload = verifyRefreshToken(tokens.refreshToken);

      expect(payload.sub).toBe('user-123');
      expect(payload.role).toBe('ADMIN');
      expect(payload.type).toBe('refresh');
    });

    it('2.3 verifyAccessToken từ chối refresh token (sai type và sai secret)', () => {
      const tokens = generateAuthTokens('user-123', 'CANDIDATE');
      expect(() => verifyAccessToken(tokens.refreshToken)).toThrow();
    });

    it('2.4 verifyRefreshToken từ chối access token (sai type và sai secret)', () => {
      const tokens = generateAuthTokens('user-123', 'CANDIDATE');
      expect(() => verifyRefreshToken(tokens.accessToken)).toThrow();
    });

    it('2.5 verifyAccessToken từ chối token có type không phải access dù dùng đúng access secret', () => {
      const fakeToken = jwt.sign(
        { sub: 'user-123', role: 'CANDIDATE', type: 'refresh' },
        process.env.JWT_ACCESS_SECRET!,
        { algorithm: 'HS256' }
      );
      expect(() => verifyAccessToken(fakeToken)).toThrow(/Invalid access token payload/);
    });
  });

  // =================================================================
  // 3. HEALTH CHECK & 404 INTEGRITY
  // =================================================================
  describe('System Integrity Routes', () => {
    it('GET /health: Hoạt động bình thường không bị ảnh hưởng', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('IT Interview AI API is running');
    });

    it('GET /api/unknown-route: Trả về 404 AppError qua globalErrorHandler', async () => {
      const res = await request(app).get('/api/unknown-route');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // =================================================================
  // 4. REGISTER HỢP LỆ & DUPLICATE
  // =================================================================
  describe('POST /api/v1/auth/register', () => {
    it('4.1 Đăng ký thành công: trả về 201, đúng message tiếng Việt UTF-8, lưu đúng 1 user, hash password, trả SafeUser', async () => {
      const payload = {
        email: 'candidate@example.com',
        password: 'StrongPassword123',
        fullName: 'Nguyen Van Candidate',
      };

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Đăng ký thành công');

      const { user, tokens } = res.body.data;
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(typeof user.id).toBe('string');
      expect(user.email).toBe('candidate@example.com');
      expect(user.fullName).toBe('Nguyen Van Candidate');
      expect(user.role).toBe('CANDIDATE');
      expect(user.status).toBe('ACTIVE');
      expect(user.createdAt).toBeDefined();

      expect(user.password).toBeUndefined();
      expect(user.passwordHash).toBeUndefined();

      expect(tokens).toBeDefined();
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');

      const userCount = await User.countDocuments();
      expect(userCount).toBe(1);

      const dbUser = await User.findOne({ email: 'candidate@example.com' }).select('+passwordHash');
      expect(dbUser).not.toBeNull();
      expect(dbUser?.role).toBe('CANDIDATE');
      expect(dbUser?.status).toBe('ACTIVE');
      expect(dbUser?.passwordHash).not.toBe('StrongPassword123');

      const isMatch = await bcrypt.compare('StrongPassword123', dbUser!.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('4.2 Đăng ký với email có khoảng trắng được tự động trim và lowercase', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: '  TrImMeD.CaNdIdAtE@eXaMpLe.CoM  ',
          password: 'StrongPassword123',
          fullName: '  Trimmed Name  ',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe('trimmed.candidate@example.com');
      expect(res.body.data.user.fullName).toBe('Trimmed Name');

      const dbUser = await User.findOne({ email: 'trimmed.candidate@example.com' });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.email).toBe('trimmed.candidate@example.com');
      expect(dbUser?.fullName).toBe('Trimmed Name');
    });

    it('4.3 Đăng ký email trùng lặp (kể cả khác chữ hoa/thường): trả về 409, AUTH_EMAIL_ALREADY_EXISTS, DB vẫn có 1 user', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'StrongPassword123',
          fullName: 'Original User',
        });

      const duplicateRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'DUPLICATE@EXAMPLE.COM',
          password: 'AnotherPassword456',
          fullName: 'Duplicate User',
        });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.success).toBe(false);
      expect(duplicateRes.body.code).toBe('AUTH_EMAIL_ALREADY_EXISTS');
      expect(duplicateRes.body.message).toBe('Email đã được sử dụng');
      expect(duplicateRes.body.errors).toBeUndefined();
      expect(duplicateRes.body.stack).toBeUndefined();

      const count = await User.countDocuments();
      expect(count).toBe(1);
    });
  });

  // =================================================================
  // 5. VALIDATION & BCRYPT BYTE LIMIT TESTS
  // =================================================================
  describe('Input Validation & Bcrypt Byte Limit', () => {
    it('5.1 Validation: Email không hợp lệ trả về 400 và VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'StrongPassword123',
          fullName: 'Valid Name',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'email')).toBe(true);
    });

    it('5.2 Validation: Mật khẩu quá ngắn (< 8 ký tự) trả về 400 và VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          fullName: 'Valid Name',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'password')).toBe(true);
    });

    it('5.3 Validation: Mật khẩu Unicode có <= 72 ký tự nhưng > 72 byte bị từ chối với 400, field = password', async () => {
      // '🔑' có 4 byte UTF-8; 20 ký tự = 80 byte > 72 byte
      const unicodePassword = '🔑'.repeat(20);
      expect(unicodePassword.length).toBe(40); // UTF-16 code units <= 72
      expect(Buffer.byteLength(unicodePassword, 'utf8')).toBe(80); // > 72 byte

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'unicode@example.com',
          password: unicodePassword,
          fullName: 'Unicode Password User',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.some((e: any) => e.field === 'password')).toBe(true);
    });

    it('5.4 Validation: FullName không hợp lệ (< 2 ký tự) trả về 400 và VALIDATION_ERROR', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'StrongPassword123',
          fullName: 'A',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'fullName')).toBe(true);
    });

    it('5.5 Validation: Gửi kèm field đặc quyền (role: ADMIN) bị từ chối với 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hacker@example.com',
          password: 'StrongPassword123',
          fullName: 'Hacker Name',
          role: 'ADMIN',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'role')).toBe(true);

      const count = await User.countDocuments();
      expect(count).toBe(0);
    });

    it('5.6 Validation: Gửi kèm field status hoặc passwordHash bị từ chối với 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'hacker2@example.com',
          password: 'StrongPassword123',
          fullName: 'Hacker Name',
          status: 'ACTIVE',
          passwordHash: 'fakehash',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('5.7 Validation Login: Mật khẩu Unicode > 72 byte ở login bị từ chối với 400, field = password', async () => {
      const unicodePassword = '🔑'.repeat(20);
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: unicodePassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors.some((e: any) => e.field === 'password')).toBe(true);
    });
  });

  // =================================================================
  // 6. LOGIN THÀNH CÔNG & THẤT BẠI
  // =================================================================
  describe('POST /api/v1/auth/login', () => {
    it('6.1 Login thành công: trả 200, đúng message tiếng Việt UTF-8, JWT payload { sub, role, type }', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'login.test@example.com',
          password: 'StrongPassword123',
          fullName: 'Login Tester',
        });
      const registeredUserId = regRes.body.data.user.id;

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login.test@example.com',
          password: 'StrongPassword123',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.message).toBe('Đăng nhập thành công');

      const { user, tokens } = loginRes.body.data;
      expect(user.id).toBe(registeredUserId);
      expect(user.email).toBe('login.test@example.com');
      expect(user.fullName).toBe('Login Tester');
      expect(user.role).toBe('CANDIDATE');
      expect(user.status).toBe('ACTIVE');
      expect(user.passwordHash).toBeUndefined();

      // Verify bằng hàm verifyAccessToken
      const accessPayload = verifyAccessToken(tokens.accessToken);
      expect(accessPayload.sub).toBe(registeredUserId);
      expect(accessPayload.role).toBe('CANDIDATE');
      expect(accessPayload.type).toBe('access');

      // Verify bằng hàm verifyRefreshToken
      const refreshPayload = verifyRefreshToken(tokens.refreshToken);
      expect(refreshPayload.sub).toBe(registeredUserId);
      expect(refreshPayload.role).toBe('CANDIDATE');
      expect(refreshPayload.type).toBe('refresh');
    });

    it('6.2 Login thành công đối với Admin đã tồn tại', async () => {
      const passwordHash = await bcrypt.hash('AdminPassword123', 10);
      const admin = await User.create({
        email: 'admin@vti.com.vn',
        passwordHash,
        fullName: 'Admin System',
        role: 'ADMIN',
        status: 'ACTIVE',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@vti.com.vn',
          password: 'AdminPassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('ADMIN');

      const accessPayload = verifyAccessToken(res.body.data.tokens.accessToken);
      expect(accessPayload.sub).toBe(admin._id.toString());
      expect(accessPayload.role).toBe('ADMIN');
    });

    it('6.3 Login thất bại: email không tồn tại và password sai trả về cùng status, code và message UTF-8', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'CorrectPassword123',
          fullName: 'Existing User',
        });

      const nonExistentRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        });

      const wrongPasswordRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'WrongPassword999',
        });

      expect(nonExistentRes.status).toBe(401);
      expect(wrongPasswordRes.status).toBe(401);

      expect(nonExistentRes.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(wrongPasswordRes.body.code).toBe('AUTH_INVALID_CREDENTIALS');

      expect(nonExistentRes.body.message).toBe('Email hoặc mật khẩu không chính xác');
      expect(wrongPasswordRes.body.message).toBe('Email hoặc mật khẩu không chính xác');
      expect(nonExistentRes.body.message).toBe(wrongPasswordRes.body.message);
    });

    it('6.4 User trạng thái INACTIVE không thể login và trả về cùng mã lỗi 401 AUTH_INVALID_CREDENTIALS', async () => {
      const passwordHash = await bcrypt.hash('InactiveUserPassword123', 10);
      await User.create({
        email: 'inactive@example.com',
        passwordHash,
        fullName: 'Inactive User',
        role: 'CANDIDATE',
        status: 'INACTIVE',
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'InactiveUserPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
      expect(res.body.message).toBe('Email hoặc mật khẩu không chính xác');
    });

    it('6.5 Validation Login: gửi field thừa bị từ chối với 400', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'StrongPassword123',
          extraField: 'not_allowed',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
