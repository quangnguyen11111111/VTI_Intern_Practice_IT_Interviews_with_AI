import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
  process.env.GOOGLE_CLIENT_ID = 'test-web-client-id.apps.googleusercontent.com';
});

import app from '../src/app';
import User from '../src/models/user.model';
import RefreshToken from '../src/models/refresh-token.model';
import { ApiRateLimitModel } from '../src/models/api-rate-limit.model';
import * as googleIdentityService from '../src/services/google-identity.service';
import { hashToken, verifyRefreshToken } from '../src/utils/token';

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
  vi.restoreAllMocks();
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  await ApiRateLimitModel.deleteMany({});
});

describe('Google Authentication Integration Tests', () => {
  it('1. Tạo tài khoản CANDIDATE mới khi chưa có subject và chưa có email', async () => {
    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'google-sub-1001',
      email: 'newbie@gmail.com',
      emailVerified: true,
      name: 'Nguyễn Văn A',
      picture: 'https://lh3.googleusercontent.com/avatar.jpg',
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Đăng nhập Google thành công');
    expect(res.body.data.user.email).toBe('newbie@gmail.com');
    expect(res.body.data.user.fullName).toBe('Nguyễn Văn A');
    expect(res.body.data.user.role).toBe('CANDIDATE');
    expect(res.body.data.user.status).toBe('ACTIVE');
    expect(res.body.data.tokens.accessToken).toBeDefined();
    expect(res.body.data.tokens.refreshToken).toBeDefined();

    // SafeUser không lộ googleSubject hay passwordHash
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.googleSubject).toBeUndefined();

    // DB chứa googleSubject, không có passwordHash
    const dbUser = await User.findOne({ email: 'newbie@gmail.com' }).select('+passwordHash +googleSubject');
    expect(dbUser).not.toBeNull();
    expect(dbUser?.googleSubject).toBe('google-sub-1001');
    expect(dbUser?.passwordHash).toBeUndefined();
    expect(dbUser?.avatarUrl).toBe('https://lh3.googleusercontent.com/avatar.jpg');
  });

  it('2. Hai request Google đồng thời không tạo duplicate user', async () => {
    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValue({
      sub: 'google-sub-race',
      email: 'race@gmail.com',
      emailVerified: true,
      name: 'Race User',
    });

    const [first, second] = await Promise.all([
      request(app).post('/api/v1/auth/google').send({ credential: 'valid.google.token' }),
      request(app).post('/api/v1/auth/google').send({ credential: 'valid.google.token' }),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.data.user.id).toBe(second.body.data.user.id);
    expect(await User.countDocuments({ email: 'race@gmail.com' })).toBe(1);
  });

  it('3. Đăng nhập lại cho người dùng Google đã tồn tại (re-login theo googleSubject)', async () => {
    const existing = await User.create({
      email: 'returning@gmail.com',
      fullName: 'Returning User',
      googleSubject: 'google-sub-1002',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      authVersion: 1,
      credentialVersion: 0,
    });

    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'google-sub-1002',
      email: 'returning@gmail.com',
      emailVerified: true,
      name: 'Ignored Name',
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(existing._id.toString());
    expect(res.body.data.user.fullName).toBe('Returning User');

    // authVersion được tăng sau khi login
    const updated = await User.findById(existing._id);
    expect(updated?.authVersion).toBe(2);
  });

  it('4. Auto-link tài khoản local Gmail hiện có và giữ nguyên fullName/avatarUrl', async () => {
    const passwordHash = await bcrypt.hash('Password123', 10);
    const localUser = await User.create({
      email: 'myaccount@gmail.com',
      fullName: 'Original Local Name',
      avatarUrl: 'https://vti.com.vn/myavatar.png',
      passwordHash,
      role: 'CANDIDATE',
      status: 'ACTIVE',
      authVersion: 0,
      credentialVersion: 0,
    });

    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'google-sub-1003',
      email: 'myaccount@gmail.com',
      emailVerified: true,
      name: 'Google Suggested Name',
      picture: 'https://lh3.googleusercontent.com/different.jpg',
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(localUser._id.toString());
    // Giữ nguyên fullName và avatar hiện tại
    expect(res.body.data.user.fullName).toBe('Original Local Name');

    const updated = await User.findById(localUser._id).select('+passwordHash +googleSubject');
    expect(updated?.googleSubject).toBe('google-sub-1003');
    expect(updated?.fullName).toBe('Original Local Name');
    expect(updated?.avatarUrl).toBe('https://vti.com.vn/myavatar.png');
    // Password hash ban đầu vẫn còn nguyên
    expect(updated?.passwordHash).toBe(passwordHash);
  });

  it('5. Auto-link tài khoản email doanh nghiệp có hd và email_verified=true', async () => {
    const localUser = await User.create({
      email: 'developer@vti.com.vn',
      fullName: 'VTI Developer',
      role: 'INTERVIEWER',
      status: 'ACTIVE',
      authVersion: 0,
      credentialVersion: 0,
    });

    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'google-sub-1004',
      email: 'developer@vti.com.vn',
      emailVerified: true,
      hd: 'vti.com.vn',
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(localUser._id.toString());

    const updated = await User.findById(localUser._id).select('+googleSubject');
    expect(updated?.googleSubject).toBe('google-sub-1004');
  });

  it('6. Từ chối auto-link third-party email không có hd trùng account local (409 AUTH_GOOGLE_ACCOUNT_LINK_REQUIRED)', async () => {
    await User.create({
      email: 'user@yahoo.com',
      fullName: 'Yahoo User',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      authVersion: 0,
      credentialVersion: 0,
    });

    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'google-sub-1005',
      email: 'user@yahoo.com',
      emailVerified: true,
      // Không có hd, không phải @gmail.com
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('AUTH_GOOGLE_ACCOUNT_LINK_REQUIRED');

    // Không được gán googleSubject
    const checkUser = await User.findOne({ email: 'user@yahoo.com' }).select('+googleSubject');
    expect(checkUser?.googleSubject).toBeUndefined();
  });

  it('7. Từ chối liên kết khi account đã liên kết với một googleSubject khác (409 AUTH_GOOGLE_SUBJECT_CONFLICT)', async () => {
    await User.create({
      email: 'user@gmail.com',
      fullName: 'Already Linked User',
      googleSubject: 'original-google-sub',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      authVersion: 0,
      credentialVersion: 0,
    });

    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'completely-different-sub',
      email: 'user@gmail.com',
      emailVerified: true,
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('AUTH_GOOGLE_SUBJECT_CONFLICT');

    // googleSubject cũ không bị ghi đè
    const checkUser = await User.findOne({ email: 'user@gmail.com' }).select('+googleSubject');
    expect(checkUser?.googleSubject).toBe('original-google-sub');
  });

  it('8. Từ chối đăng nhập Google với tài khoản bị khóa (403 AUTH_ACCOUNT_LOCKED)', async () => {
    await User.create({
      email: 'locked@gmail.com',
      fullName: 'Locked User',
      googleSubject: 'google-sub-locked',
      role: 'CANDIDATE',
      status: 'LOCKED',
      authVersion: 0,
      credentialVersion: 0,
    });

    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'google-sub-locked',
      email: 'locked@gmail.com',
      emailVerified: true,
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('AUTH_ACCOUNT_LOCKED');
  });

  it('9. Từ chối đăng nhập Google với tài khoản INACTIVE (401 AUTH_UNAUTHORIZED)', async () => {
    await User.create({
      email: 'inactive@gmail.com',
      fullName: 'Inactive User',
      googleSubject: 'google-sub-inactive',
      role: 'CANDIDATE',
      status: 'INACTIVE',
      authVersion: 0,
      credentialVersion: 0,
    });

    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'google-sub-inactive',
      email: 'inactive@gmail.com',
      emailVerified: true,
    });

    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
  });

  it('10. Refresh token được lưu dưới dạng hash và dùng được với /auth/refresh', async () => {
    vi.spyOn(googleIdentityService, 'verifyGoogleIdToken').mockResolvedValueOnce({
      sub: 'google-sub-session',
      email: 'session@gmail.com',
      emailVerified: true,
      name: 'Session User',
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/google')
      .send({ credential: 'valid.google.token' });

    expect(loginRes.status).toBe(200);
    const { refreshToken } = loginRes.body.data.tokens;

    // Refresh token hash trong DB
    const expectedHash = hashToken(refreshToken);
    const sessionDoc = await RefreshToken.findOne({ tokenHash: expectedHash });
    expect(sessionDoc).not.toBeNull();
    expect(sessionDoc?.isRevoked).toBe(false);

    // Xác nhận token hoạt động với /auth/refresh
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.tokens.accessToken).toBeDefined();
    expect(refreshRes.body.data.tokens.refreshToken).toBeDefined();
  });

  it('11. Đăng nhập mật khẩu cho tài khoản Google-only trả 401 AUTH_INVALID_CREDENTIALS không ném 500', async () => {
    await User.create({
      email: 'googleonly@gmail.com',
      fullName: 'Google Only',
      googleSubject: 'google-sub-only',
      role: 'CANDIDATE',
      status: 'ACTIVE',
      authVersion: 0,
      credentialVersion: 0,
      // Không có passwordHash
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'googleonly@gmail.com',
        password: 'RandomPassword123',
      });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('12. Validation: Từ chối body thiếu, rỗng, không phải string hoặc vượt quá 8192 ký tự', async () => {
    // Missing body
    const res1 = await request(app).post('/api/v1/auth/google').send({});
    expect(res1.status).toBe(400);

    // Empty credential
    const res2 = await request(app).post('/api/v1/auth/google').send({ credential: '   ' });
    expect(res2.status).toBe(400);

    // Non-string
    const res3 = await request(app).post('/api/v1/auth/google').send({ credential: 12345 });
    expect(res3.status).toBe(400);

    // Exceeding 8192 chars
    const res4 = await request(app).post('/api/v1/auth/google').send({ credential: 'a'.repeat(8193) });
    expect(res4.status).toBe(400);

    // Extra forbidden client claims
    const res5 = await request(app).post('/api/v1/auth/google').send({
      credential: 'valid.credential',
      email: 'hacker@example.com',
      role: 'ADMIN',
    });
    expect(res5.status).toBe(400);
  });

  it('13. Helmet cấu hình đúng CSP và COOP cho Google Identity Services', async () => {
    const res = await request(app).get('/health');

    // Cross-Origin-Opener-Policy: same-origin-allow-popups
    expect(res.headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');

    // Content-Security-Policy
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain('https://accounts.google.com/gsi/client');
    expect(csp).toContain('https://accounts.google.com/gsi/');
    expect(csp).toContain('https://*.googleusercontent.com');
  });
});
