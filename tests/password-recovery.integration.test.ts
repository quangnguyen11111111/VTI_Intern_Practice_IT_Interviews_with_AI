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
  process.env.PASSWORD_RESET_SECRET = 'test_password_reset_secret_key_at_least_32_chars_long_12345';
});

import app from '../src/app';
import User from '../src/models/user.model';
import RefreshToken from '../src/models/refresh-token.model';
import PasswordResetOtp from '../src/models/password-reset-otp.model';
import PasswordResetRateLimit from '../src/models/password-reset-rate-limit.model';
import { emailService, IEmailProvider, SendEmailOptions } from '../src/services/email.service';
import { generateAuthTokens } from '../src/utils/token';
import { hashEmail, hashOtp } from '../src/services/auth.service';
import { getEnv } from '../src/config/env';

let mongoReplSet: MongoMemoryReplSet;

class MockEmailProvider implements IEmailProvider {
  public sentEmails: SendEmailOptions[] = [];
  public shouldFail = false;
  public failureError = new Error('SMTP connection timed out');

  async sendEmail(options: SendEmailOptions): Promise<void> {
    if (this.shouldFail) {
      throw this.failureError;
    }
    this.sentEmails.push(options);
  }

  clear() {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}

const mockEmailProvider = new MockEmailProvider();

beforeAll(async () => {
  mongoReplSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongoReplSet.getUri();
  await mongoose.connect(uri);
  emailService.setProvider(mockEmailProvider);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoReplSet.stop();
});

beforeEach(async () => {
  mockEmailProvider.clear();
  await User.deleteMany({});
  await RefreshToken.deleteMany({});
  await PasswordResetOtp.deleteMany({});
  await PasswordResetRateLimit.deleteMany({});
});

describe('AIP-20 AUTH-06: Password Recovery & Management Integration Tests', () => {
  describe('Password recovery environment validation', () => {
    it('rejects invalid SMTP booleans and example SMTP placeholders in production', () => {
      const keys = [
        'NODE_ENV',
        'SMTP_HOST',
        'SMTP_PORT',
        'SMTP_SECURE',
        'SMTP_USER',
        'SMTP_PASS',
        'SMTP_FROM',
      ] as const;
      const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

      try {
        process.env.NODE_ENV = 'test';
        process.env.SMTP_SECURE = 'sometimes';
        expect(() => getEnv()).toThrow(/SMTP_SECURE/);

        process.env.NODE_ENV = 'production';
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_SECURE = 'false';
        process.env.SMTP_USER = 'replace-with-smtp-user';
        process.env.SMTP_PASS = 'replace-with-smtp-password';
        process.env.SMTP_FROM = 'no-reply@example.com';
        expect(() => getEnv()).toThrow(/placeholder/);
      } finally {
        for (const key of keys) {
          const value = original[key];
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });
  });

  // =========================================================================
  // 1. PATCH /api/v1/auth/password (Authenticated Password Change)
  // =========================================================================
  describe('PATCH /api/v1/auth/password', () => {
    it('1.1 Từ chối request không có access token xác thực (401)', async () => {
      const res = await request(app)
        .patch('/api/v1/auth/password')
        .send({
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_UNAUTHORIZED');
    });

    it('1.2 Từ chối mật khẩu hiện tại không chính xác với mã lỗi chuẩn hóa non-sensitive (400)', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'changepass@example.com',
          password: 'CorrectOldPassword123',
          fullName: 'Change Pass User',
        });

      const { accessToken } = regRes.body.data.tokens;

      const res = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongOldPassword999',
          newPassword: 'BrandNewPassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_INVALID_CURRENT_PASSWORD');
      expect(res.body.message).toBe('Mật khẩu hiện tại không chính xác');
    });

    it('1.3 Từ chối đặt mật khẩu mới trùng với mật khẩu hiện tại (400)', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'samepass@example.com',
          password: 'IdenticalPassword123',
          fullName: 'Same Pass User',
        });

      const { accessToken } = regRes.body.data.tokens;

      const res = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'IdenticalPassword123',
          newPassword: 'IdenticalPassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_PASSWORD_REUSED');
      expect(res.body.message).toBe('Mật khẩu mới không được trùng với mật khẩu hiện tại');
    });

    it('1.4 Validate mật khẩu hiện tại/mới < 8 ký tự hoặc > 72 byte bị từ chối 400', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'shortpass@example.com',
          password: 'OldPassword123',
          fullName: 'Short Pass User',
        });

      const { accessToken } = regRes.body.data.tokens;

      const shortCurrentRes = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'short',
          newPassword: 'ValidNewPassword123',
        });

      expect(shortCurrentRes.status).toBe(400);
      expect(shortCurrentRes.body.code).toBe('VALIDATION_ERROR');
      expect(shortCurrentRes.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'currentPassword' })])
      );

      const shortRes = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123',
          newPassword: 'short',
        });

      expect(shortRes.status).toBe(400);
      expect(shortRes.body.code).toBe('VALIDATION_ERROR');

      const unicodeOver72Bytes = '🔑'.repeat(20);
      const longRes = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123',
          newPassword: unicodeOver72Bytes,
        });

      expect(longRes.status).toBe(400);
      expect(longRes.body.code).toBe('VALIDATION_ERROR');
    });

    it('1.5 Từ chối các field thừa trong request body (strict validation)', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'strictpass@example.com',
          password: 'OldPassword123',
          fullName: 'Strict Pass User',
        });

      const { accessToken } = regRes.body.data.tokens;

      const res = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'OldPassword123',
          newPassword: 'ValidNewPassword123',
          extraField: 'hacked',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('1.6 Đổi mật khẩu thành công: Hash mật khẩu mới, tăng credentialVersion & authVersion, vô hiệu hóa access token cũ và thu hồi toàn bộ RefreshToken', async () => {
      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'successpass@example.com',
          password: 'InitialPassword123',
          fullName: 'Success Pass User',
        });

      const userId = regRes.body.data.user.id;
      const initialRefreshToken = regRes.body.data.tokens.refreshToken;
      const initialAccessToken = regRes.body.data.tokens.accessToken;

      const userBefore = await User.findById(userId);
      const initialAuthVersion = userBefore?.authVersion ?? 0;
      const initialCredentialVersion = userBefore?.credentialVersion ?? 0;

      // Create a second login session for the same user
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'successpass@example.com',
          password: 'InitialPassword123',
        });
      const secondRefreshToken = loginRes.body.data.tokens.refreshToken;

      // Perform password change
      const changeRes = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .send({
          currentPassword: 'InitialPassword123',
          newPassword: 'BrandNewStrongPassword456',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);
      expect(changeRes.body.message).toBe('Đổi mật khẩu thành công');

      // Verify user DB state
      const userAfter = await User.findById(userId).select('+passwordHash');
      expect(userAfter?.authVersion).toBeGreaterThan(initialAuthVersion);
      expect(userAfter?.credentialVersion).toBeGreaterThan(initialCredentialVersion);

      const oldMatch = await bcrypt.compare('InitialPassword123', userAfter!.passwordHash);
      expect(oldMatch).toBe(false);

      const newMatch = await bcrypt.compare('BrandNewStrongPassword456', userAfter!.passwordHash);
      expect(newMatch).toBe(true);

      // Verify all previous refresh tokens are revoked
      const activeSessions = await RefreshToken.find({ userId, isRevoked: false });
      expect(activeSessions).toHaveLength(0);

      // Old access token fails on next authenticated request (credentialVersion invalidated)
      const oldAccessRes = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .send({
          currentPassword: 'BrandNewStrongPassword456',
          newPassword: 'AnotherPassword123',
        });
      expect(oldAccessRes.status).toBe(401);
      expect(oldAccessRes.body.code).toBe('AUTH_UNAUTHORIZED');

      // Old refresh token 1 fails
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });
      expect(refresh1.status).toBe(401);

      // Old refresh token 2 fails
      const refresh2 = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: secondRefreshToken });
      expect(refresh2.status).toBe(401);

      // Old password fails login
      const failedLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'successpass@example.com',
          password: 'InitialPassword123',
        });
      expect(failedLogin.status).toBe(401);

      // New password succeeds login
      const successfulLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'successpass@example.com',
          password: 'BrandNewStrongPassword456',
        });
      expect(successfulLogin.status).toBe(200);
      expect(successfulLogin.body.data.user.email).toBe('successpass@example.com');
    });

    it('1.7 Hai yêu cầu đổi cùng mật khẩu hiện tại không thể cùng thắng', async () => {
      const registration = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'change-race@example.com',
          password: 'OriginalPassword123',
          fullName: 'Change Race User',
        });

      const accessToken = registration.body.data.tokens.accessToken;
      const [first, second] = await Promise.all([
        request(app)
          .patch('/api/v1/auth/password')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ currentPassword: 'OriginalPassword123', newPassword: 'FirstPassword123' }),
        request(app)
          .patch('/api/v1/auth/password')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({ currentPassword: 'OriginalPassword123', newPassword: 'SecondPassword123' }),
      ]);

      expect([first.status, second.status].sort()).toEqual([200, 409]);
      const rejected = first.status === 409 ? first : second;
      expect(rejected.body.code).toBe('AUTH_PASSWORD_CHANGED');
    });
  });

  // =========================================================================
  // 2. POST /api/v1/auth/password/forgot (Forgot Password Request)
  // =========================================================================
  describe('POST /api/v1/auth/password/forgot', () => {
    it('2.1 Trả về phản hồi generic 202 giống nhau cho email đã đăng ký và chưa đăng ký', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'registered@example.com',
          password: 'Password12345',
          fullName: 'Registered User',
        });

      // Registered email
      const regForgot = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'registered@example.com' });

      // Unregistered email
      const unregForgot = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'unregistered@example.com' });

      expect(regForgot.status).toBe(202);
      expect(unregForgot.status).toBe(202);

      expect(regForgot.body.success).toBe(true);
      expect(unregForgot.body.success).toBe(true);

      expect(regForgot.body.message).toBe(unregForgot.body.message);
      expect(regForgot.body.message).toBe('Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã xác thực để đặt lại mật khẩu.');
    });

    it('2.2 Lưu trữ bản ghi PasswordResetOtp với emailHash và otpHash (không lưu raw email hay raw OTP)', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'security.check@example.com',
          password: 'Password12345',
          fullName: 'Security Check User',
        });

      mockEmailProvider.clear();

      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'security.check@example.com' });

      const emailHmac = hashEmail('security.check@example.com');
      const record = await PasswordResetOtp.findOne({ emailHash: emailHmac });

      expect(record).not.toBeNull();
      expect(record?.emailHash).toBe(emailHmac);
      expect(record?.otpHash).toBeDefined();
      expect(typeof record?.otpHash).toBe('string');
      expect(record?.otpHash.length).toBe(64); // SHA-256 HMAC hex string
      expect(record?.deliveryState).toBe('SENT');
      expect(record?.attempts).toBe(0);
      expect(record?.usedAt).toBeNull();
      expect(record?.isSynthetic).toBe(false);

      // Verify no raw email or raw OTP is in the model document
      const docJson = record?.toJSON();
      expect((docJson as any).email).toBeUndefined();
      expect((docJson as any).otp).toBeUndefined();
      expect((docJson as any).rawEmail).toBeUndefined();
      expect((docJson as any).rawOtp).toBeUndefined();
    });

    it('2.3 Tạo synthetic record và gọi email provider ngay cả khi email không tồn tại', async () => {
      mockEmailProvider.clear();

      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'unknown.user@example.com' });

      const emailHmac = hashEmail('unknown.user@example.com');
      const record = await PasswordResetOtp.findOne({ emailHash: emailHmac });

      expect(record).not.toBeNull();
      expect(record?.isSynthetic).toBe(true);
      expect(record?.userId).toBeNull();
      expect(mockEmailProvider.sentEmails).toHaveLength(1);
    });

    it('2.4 Khi email delivery thất bại, trả về lỗi 503 retryable giống nhau cho cả email thật và giả, invalidate record', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'registered.fail@example.com',
          password: 'Password12345',
          fullName: 'Registered Fail User',
        });

      mockEmailProvider.shouldFail = true;

      // Registered email
      const regRes = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'registered.fail@example.com' });

      // Unregistered email
      const unregRes = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'unregistered.fail@example.com' });

      expect(regRes.status).toBe(503);
      expect(unregRes.status).toBe(503);

      expect(regRes.body.success).toBe(false);
      expect(unregRes.body.success).toBe(false);

      expect(regRes.body.message).toBe(unregRes.body.message);
      expect(regRes.body.message).toBe('Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.');

      // Verify records are marked FAILED
      const regRecord = await PasswordResetOtp.findOne({ emailHash: hashEmail('registered.fail@example.com') });
      expect(regRecord?.deliveryState).toBe('FAILED');

      const unregRecord = await PasswordResetOtp.findOne({ emailHash: hashEmail('unregistered.fail@example.com') });
      expect(unregRecord?.deliveryState).toBe('FAILED');
    });

    it('2.5 Request cooldown 60 giây: Gửi lại trong 60s trả về 202 accepted và bảo toàn OTP ban đầu', async () => {
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'cooldown@example.com',
          password: 'Password12345',
          fullName: 'Cooldown User',
        });

      mockEmailProvider.clear();

      // First request
      const firstRes = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'cooldown@example.com' });
      expect(firstRes.status).toBe(202);
      expect(mockEmailProvider.sentEmails).toHaveLength(1);

      const emailHmac = hashEmail('cooldown@example.com');
      const firstRecord = await PasswordResetOtp.findOne({ emailHash: emailHmac });
      const originalOtpHash = firstRecord?.otpHash;

      // Second request immediately (< 60s)
      const secondRes = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email: 'cooldown@example.com' });
      expect(secondRes.status).toBe(202);

      // Email provider should NOT be called again (preserving original OTP)
      expect(mockEmailProvider.sentEmails).toHaveLength(1);

      // Record in DB should still have the original OTP hash
      const count = await PasswordResetOtp.countDocuments({ emailHash: emailHmac });
      expect(count).toBe(1);
      const afterRecord = await PasswordResetOtp.findOne({ emailHash: emailHmac });
      expect(afterRecord?.otpHash).toBe(originalOtpHash);
    });

    it('2.6 Giới hạn tối đa 5 yêu cầu trong 1 giờ lăn (rolling hour): Yêu cầu thứ 6 bị từ chối 429', async () => {
      const email = 'ratelimit@example.com';
      const emailHmac = hashEmail(email);

      // Populate rate limit model with 5 requests across the past 50 minutes
      const timestamps = [
        new Date(Date.now() - 50 * 60 * 1000),
        new Date(Date.now() - 40 * 60 * 1000),
        new Date(Date.now() - 30 * 60 * 1000),
        new Date(Date.now() - 20 * 60 * 1000),
        new Date(Date.now() - 10 * 60 * 1000),
      ];

      await PasswordResetRateLimit.create({
        emailHash: emailHmac,
        requestTimestamps: timestamps,
        cooldownExpiresAt: new Date(Date.now() - 5 * 60 * 1000),
        purgeAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      // 6th request within the rolling hour
      const res = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_TOO_MANY_REQUESTS');
    });

    it('2.7 Yêu cầu quên mật khẩu đồng thời (concurrency): Chỉ gửi tối đa 1 email xác thực', async () => {
      const email = 'concurrent.forgot@example.com';
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password12345',
          fullName: 'Concurrent User',
        });

      mockEmailProvider.clear();

      // Launch 5 parallel forgot-password requests
      const responses = await Promise.all([
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
      ]);

      // All parallel requests receive 202
      for (const res of responses) {
        expect(res.status).toBe(202);
      }

      // Exactly 1 email sent by provider
      expect(mockEmailProvider.sentEmails).toHaveLength(1);

      // Exactly 1 OTP record in DB
      const otpCount = await PasswordResetOtp.countDocuments({ emailHash: hashEmail(email) });
      expect(otpCount).toBe(1);
    });

    it('2.8 Fifth/Sixth boundary under concurrency: Giới hạn 5 lần/giờ không thể bị vượt qua bởi các request đồng thời', async () => {
      const email = 'boundary.concurrency@example.com';
      const emailHmac = hashEmail(email);

      // Pre-populate with 4 valid timestamps in rolling hour
      const timestamps = [
        new Date(Date.now() - 40 * 60 * 1000),
        new Date(Date.now() - 30 * 60 * 1000),
        new Date(Date.now() - 20 * 60 * 1000),
        new Date(Date.now() - 10 * 60 * 1000),
      ];

      await PasswordResetRateLimit.create({
        emailHash: emailHmac,
        requestTimestamps: timestamps,
        cooldownExpiresAt: new Date(Date.now() - 5 * 60 * 1000),
        purgeAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      mockEmailProvider.clear();

      // Send 5 parallel requests when only 1 request is remaining in the hour
      const responses = await Promise.all([
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
        request(app).post('/api/v1/auth/password/forgot').send({ email }),
      ]);

      // Exactly 1 email sent (5th reservation)
      expect(mockEmailProvider.sentEmails).toHaveLength(1);

      // Verify rate limit doc in DB has exactly 5 timestamps (capped at 5)
      const rateLimitDoc = await PasswordResetRateLimit.findOne({ emailHash: emailHmac });
      expect(rateLimitDoc?.requestTimestamps).toHaveLength(5);
    });

    it('2.9 Provider failure giải phóng reservation & cooldown và cho phép thử lại ngay khi provider phục hồi', async () => {
      const email = 'retry.recovery@example.com';
      const emailHmac = hashEmail(email);

      mockEmailProvider.shouldFail = true;

      const failRes = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });
      expect(failRes.status).toBe(503);

      // Verify reservation and cooldown are released
      const rateLimitAfterFail = await PasswordResetRateLimit.findOne({ emailHash: emailHmac });
      expect(rateLimitAfterFail?.reservationId).toBeNull();
      expect(rateLimitAfterFail?.cooldownExpiresAt).toBeNull();
      expect(rateLimitAfterFail?.requestTimestamps).toHaveLength(1); // Hourly accounting retained

      // Recover provider
      mockEmailProvider.shouldFail = false;

      // Immediate retry succeeds without being blocked by cooldown
      const retryRes = await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });
      expect(retryRes.status).toBe(202);
      expect(mockEmailProvider.sentEmails).toHaveLength(1);
    });

    it('2.10 Hashed-only persistence: Không lưu trữ plain email hoặc plain OTP trong MongoDB', async () => {
      const email = 'hashed.persistence@example.com';
      mockEmailProvider.clear();

      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });

      const emailHmac = hashEmail(email);
      const rateLimitDoc = await PasswordResetRateLimit.findOne({ emailHash: emailHmac });
      expect(rateLimitDoc).not.toBeNull();

      const rateLimitJson = JSON.stringify(rateLimitDoc?.toJSON());
      expect(rateLimitJson).not.toContain(email);

      const otpDoc = await PasswordResetOtp.findOne({ emailHash: emailHmac });
      expect(otpDoc).not.toBeNull();

      const otpJson = JSON.stringify(otpDoc?.toJSON());
      expect(otpJson).not.toContain(email);
    });
  });

  // =========================================================================
  // 3. POST /api/v1/auth/password/reset (Reset Password with OTP)
  // =========================================================================
  describe('POST /api/v1/auth/password/reset', () => {
    it('3.1 Đặt lại mật khẩu thành công với OTP hợp lệ: Cập nhật passwordHash, tăng credentialVersion & authVersion, vô hiệu hóa access token cũ, thu hồi toàn bộ RefreshToken', async () => {
      const email = 'reset.success@example.com';
      const initialPassword = 'InitialPassword123';
      const newPassword = 'BrandNewPassword789';

      const regRes = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: initialPassword,
          fullName: 'Reset Success User',
        });
      const userId = regRes.body.data.user.id;
      const initialRefreshToken = regRes.body.data.tokens.refreshToken;
      const initialAccessToken = regRes.body.data.tokens.accessToken;

      // Request OTP
      mockEmailProvider.clear();
      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });

      // Extract raw OTP from mock provider
      const sentEmail = mockEmailProvider.sentEmails[0];
      expect(sentEmail).toBeDefined();
      const otpMatch = sentEmail.text?.match(/\b(\d{6})\b/);
      expect(otpMatch).not.toBeNull();
      const rawOtp = otpMatch![1];

      // Perform Reset
      const resetRes = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({
          email,
          otp: rawOtp,
          newPassword,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.message).toBe('Đặt lại mật khẩu thành công');

      // Verify DB user
      const user = await User.findById(userId).select('+passwordHash');
      expect(user?.credentialVersion).toBe(1);

      const isOldPasswordMatch = await bcrypt.compare(initialPassword, user!.passwordHash);
      expect(isOldPasswordMatch).toBe(false);

      const isNewPasswordMatch = await bcrypt.compare(newPassword, user!.passwordHash);
      expect(isNewPasswordMatch).toBe(true);

      // Verify sessions revoked
      const activeSessions = await RefreshToken.find({ userId, isRevoked: false });
      expect(activeSessions).toHaveLength(0);

      // Stale access token fails on next authenticated request
      const oldAccessAfterReset = await request(app)
        .patch('/api/v1/auth/password')
        .set('Authorization', `Bearer ${initialAccessToken}`)
        .send({
          currentPassword: newPassword,
          newPassword: 'AnotherPassword999',
        });
      expect(oldAccessAfterReset.status).toBe(401);
      expect(oldAccessAfterReset.body.code).toBe('AUTH_UNAUTHORIZED');

      // Old refresh token rejected
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: initialRefreshToken });
      expect(refreshRes.status).toBe(401);

      // Login with new password works
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email, password: newPassword });
      expect(loginRes.status).toBe(200);
    });

    it('3.2 Synthetic OTP hợp lệ trả về cùng định dạng 200 mà không sửa đổi user, chống account enumeration', async () => {
      const email = 'synthetic.reset@example.com';

      mockEmailProvider.clear();
      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });

      const sentEmail = mockEmailProvider.sentEmails[0];
      const otpMatch = sentEmail.text?.match(/\b(\d{6})\b/);
      const rawOtp = otpMatch![1];

      const resetRes = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({
          email,
          otp: rawOtp,
          newPassword: 'SomeNewPassword123',
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.message).toBe('Đặt lại mật khẩu thành công');

      // Ensure no user was created
      const count = await User.countDocuments({ email });
      expect(count).toBe(0);
    });

    it('3.3 OTP không chính xác dùng mã lỗi chuẩn hóa canonical (400) và tăng số lần thử attempts', async () => {
      const email = 'wrongotp@example.com';
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password12345',
          fullName: 'Wrong OTP User',
        });

      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });

      const emailHmac = hashEmail(email);

      const res = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({
          email,
          otp: '000000',
          newPassword: 'NewPassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('AUTH_INVALID_OR_EXPIRED_OTP');
      expect(res.body.message).toBe('Mã xác thực không hợp lệ hoặc đã hết hạn');

      const record = await PasswordResetOtp.findOne({ emailHash: emailHmac });
      expect(record?.attempts).toBe(1);
    });

    it('3.4 Vượt quá 5 lần thử OTP sai (brute-force cap) sẽ khóa OTP với canonical error (400)', async () => {
      const email = 'bruteforce@example.com';
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password12345',
          fullName: 'Brute Force User',
        });

      mockEmailProvider.clear();
      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });

      const sentEmail = mockEmailProvider.sentEmails[0];
      const otpMatch = sentEmail.text?.match(/\b(\d{6})\b/);
      const correctOtp = otpMatch![1];

      // 5 wrong attempts
      for (let i = 0; i < 5; i++) {
        const wrongRes = await request(app)
          .post('/api/v1/auth/password/reset')
          .send({
            email,
            otp: '999999',
            newPassword: 'NewPassword123',
          });
        expect(wrongRes.status).toBe(400);
        expect(wrongRes.body.code).toBe('AUTH_INVALID_OR_EXPIRED_OTP');
      }

      // 6th attempt with correct OTP is now rejected due to exhausted attempts
      const exhaustedRes = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({
          email,
          otp: correctOtp,
          newPassword: 'NewPassword123',
        });

      expect(exhaustedRes.status).toBe(400);
      expect(exhaustedRes.body.code).toBe('AUTH_INVALID_OR_EXPIRED_OTP');
    });

    it('3.5 OTP đã hết hạn (> 10 phút) bị từ chối với canonical error (400)', async () => {
      const email = 'expired@example.com';
      const emailHmac = hashEmail(email);

      await PasswordResetOtp.create({
        emailHash: emailHmac,
        otpHash: hashOtp('123456'),
        userId: null,
        isSynthetic: true,
        attempts: 0,
        deliveryState: 'SENT',
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
        purgeAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      const res = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({
          email,
          otp: '123456',
          newPassword: 'NewPassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('AUTH_INVALID_OR_EXPIRED_OTP');
    });

    it('3.5b OTP chưa được email provider xác nhận gửi không thể sử dụng', async () => {
      const email = 'pending-delivery@example.com';
      const record = await PasswordResetOtp.create({
        emailHash: hashEmail(email),
        otpHash: hashOtp('123456'),
        userId: null,
        isSynthetic: true,
        attempts: 0,
        deliveryState: 'PENDING',
        usedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        purgeAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      });

      const response = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({ email, otp: '123456', newPassword: 'NewPassword123' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('AUTH_INVALID_OR_EXPIRED_OTP');
      expect((await PasswordResetOtp.findById(record._id))?.usedAt).toBeNull();
    });

    it('3.6 Tính chất single-use: Không thể dùng lại OTP đã tiêu thụ lần thứ 2 (400)', async () => {
      const email = 'singleuse@example.com';
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password12345',
          fullName: 'Single Use User',
        });

      mockEmailProvider.clear();
      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });

      const sentEmail = mockEmailProvider.sentEmails[0];
      const otpMatch = sentEmail.text?.match(/\b(\d{6})\b/);
      const rawOtp = otpMatch![1];

      // First reset: succeeds
      const firstReset = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({
          email,
          otp: rawOtp,
          newPassword: 'FirstNewPassword123',
        });
      expect(firstReset.status).toBe(200);

      // Second reset with same OTP: fails
      const secondReset = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({
          email,
          otp: rawOtp,
          newPassword: 'SecondNewPassword123',
        });
      expect(secondReset.status).toBe(400);
      expect(secondReset.body.code).toBe('AUTH_INVALID_OR_EXPIRED_OTP');
    });

    it('3.7 Race condition tiêu thụ OTP đồng thời: Chỉ duy nhất 1 request thành công, request còn lại bị từ chối', async () => {
      const email = 'race.reset@example.com';
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password12345',
          fullName: 'Race Reset User',
        });

      mockEmailProvider.clear();
      await request(app)
        .post('/api/v1/auth/password/forgot')
        .send({ email });

      const sentEmail = mockEmailProvider.sentEmails[0];
      const otpMatch = sentEmail.text?.match(/\b(\d{6})\b/);
      const rawOtp = otpMatch![1];

      // Fire 2 concurrent reset requests
      const [res1, res2] = await Promise.all([
        request(app).post('/api/v1/auth/password/reset').send({
          email,
          otp: rawOtp,
          newPassword: 'WinningPassword123',
        }),
        request(app).post('/api/v1/auth/password/reset').send({
          email,
          otp: rawOtp,
          newPassword: 'LosingPassword456',
        }),
      ]);

      const responses = [res1, res2];
      const successes = responses.filter((r) => r.status === 200);
      const failures = responses.filter((r) => r.status === 400);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].body.code).toBe('AUTH_INVALID_OR_EXPIRED_OTP');
    });
  });
});
