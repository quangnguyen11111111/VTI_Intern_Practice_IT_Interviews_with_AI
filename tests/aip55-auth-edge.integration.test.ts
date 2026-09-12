import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'aip55_access_secret_key_at_least_32_characters_123';
  process.env.JWT_REFRESH_SECRET = 'aip55_refresh_secret_key_at_least_32_characters_456';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

import User from '../src/models/user.model';
import RefreshToken from '../src/models/refresh-token.model';
import PasswordResetOtp from '../src/models/password-reset-otp.model';
import PasswordResetRateLimit from '../src/models/password-reset-rate-limit.model';
import {
  acquirePasswordResetReservation,
  changePassword,
  hashEmail,
  hashOtp,
  lockUser,
  logoutUser,
  refreshAuthTokens,
  resetPassword,
} from '../src/services/auth.service';
import { authorize, requireOwnership } from '../src/middlewares/auth.middleware';
import {
  createUserFixture,
  persistRefreshSession,
  UserFixture,
} from './fixtures/aip55.factories';

let mongo: MongoMemoryReplSet;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri('aip55_auth_edges'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
    PasswordResetOtp.deleteMany({}),
    PasswordResetRateLimit.deleteMany({}),
  ]);
});

describe('AIP-55 password-reset reservation failures', () => {
  it('propagates non-duplicate persistence errors instead of bypassing the limiter', async () => {
    const persistenceError = Object.assign(new Error('rate-limit store unavailable'), { code: 91 });
    const updateSpy = vi
      .spyOn(PasswordResetRateLimit, 'updateOne')
      .mockRejectedValueOnce(persistenceError);

    await expect(
      acquirePasswordResetReservation(hashEmail('candidate@example.com'), new Date())
    ).rejects.toBe(persistenceError);

    updateSpy.mockRestore();
  });
});

const expectAuthError = async (
  operation: Promise<unknown>,
  statusCode: number,
  code: string,
  contract: string
) => {
  await expect(operation, contract).rejects.toMatchObject({ statusCode, code });
};

describe('AIP-55 refresh/logout negative contracts', () => {
  it('rejects refresh sessions whose user disappeared, became inactive, changed credentials, or expired', async () => {
    const missingUser = await createUserFixture();
    await persistRefreshSession(missingUser);
    await User.deleteOne({ _id: missingUser.user._id });
    await expectAuthError(
      refreshAuthTokens(missingUser.refreshToken),
      401,
      'AUTH_UNAUTHORIZED',
      'AIP-55 contract: a refresh token cannot outlive its user'
    );

    const inactive = await createUserFixture();
    await persistRefreshSession(inactive);
    await User.updateOne({ _id: inactive.user._id }, { status: 'INACTIVE' });
    await expectAuthError(
      refreshAuthTokens(inactive.refreshToken),
      401,
      'AUTH_UNAUTHORIZED',
      'AIP-55 contract: inactive users cannot refresh'
    );

    const stale = await createUserFixture();
    await persistRefreshSession(stale);
    await User.updateOne({ _id: stale.user._id }, { credentialVersion: 1 });
    await expectAuthError(
      refreshAuthTokens(stale.refreshToken),
      401,
      'AUTH_INVALID_REFRESH_TOKEN',
      'AIP-55 contract: credential rotation invalidates stale refresh tokens'
    );

    const expired = await createUserFixture();
    const expiredRecord = await persistRefreshSession(expired);
    await RefreshToken.updateOne(
      { _id: expiredRecord._id },
      { expiresAt: new Date(Date.now() - 1_000) }
    );
    await expectAuthError(
      refreshAuthTokens(expired.refreshToken),
      401,
      'AUTH_EXPIRED_REFRESH_TOKEN',
      'AIP-55 contract: an expired stored refresh session cannot rotate'
    );
  });

  it('keeps logout idempotent only for a token bound to a known session', async () => {
    const fixture = await createUserFixture();
    await persistRefreshSession(fixture);

    await logoutUser(fixture.refreshToken);
    await logoutUser(fixture.refreshToken);

    const record = await RefreshToken.findOne({ userId: fixture.user._id }).lean();
    expect(record, 'AIP-55 contract: repeated logout keeps one revoked session record')
      .toMatchObject({ isRevoked: true });

    const unknownSession = await createUserFixture();
    await expectAuthError(
      logoutUser(unknownSession.refreshToken),
      401,
      'AUTH_INVALID_REFRESH_TOKEN',
      'AIP-55 contract: logout must not accept a forged-but-signed unknown session'
    );
  });

  it('rejects logout identities with malformed binding claims or a deleted user', async () => {
    const fixture = await createUserFixture();
    const malformedIdentity = jwt.sign(
      {
        sub: fixture.user._id.toString(),
        role: 'CANDIDATE',
        type: 'refresh',
        credentialVersion: 0,
        jti: 'not-a-uuid',
        sessionId: '54b1682e-6930-4c8d-95ed-2f2fbb7ad978',
      },
      process.env.JWT_REFRESH_SECRET!,
      { algorithm: 'HS256', expiresIn: '7d' }
    );
    await expectAuthError(
      logoutUser(malformedIdentity),
      401,
      'AUTH_INVALID_REFRESH_TOKEN',
      'AIP-55 contract: malformed refresh identity claims fail closed'
    );
    await expectAuthError(
      refreshAuthTokens(malformedIdentity),
      401,
      'AUTH_INVALID_REFRESH_TOKEN',
      'AIP-55 contract: refresh also rejects malformed session binding claims'
    );

    await persistRefreshSession(fixture);
    await User.deleteOne({ _id: fixture.user._id });
    await expectAuthError(
      logoutUser(fixture.refreshToken),
      401,
      'AUTH_UNAUTHORIZED',
      'AIP-55 contract: logout does not trust a deleted user identity'
    );
  });

  it('does not recreate a user deleted between OTP issuance and password reset', async () => {
    const fixture = await createUserFixture();
    const otp = '481516';
    await PasswordResetOtp.create({
      emailHash: hashEmail(fixture.user.email),
      otpHash: hashOtp(otp),
      userId: fixture.user._id,
      isSynthetic: false,
      attempts: 0,
      deliveryState: 'SENT',
      usedAt: null,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      purgeAt: new Date(Date.now() + 60 * 60_000),
    });
    await User.deleteOne({ _id: fixture.user._id });

    await resetPassword(fixture.user.email, otp, 'ReplacementPassword123');

    expect(
      await User.findById(fixture.user._id),
      'AIP-55 contract: password reset must not resurrect a deleted account'
    ).toBeNull();
  });
});

describe('AIP-55 service-level authorization fail-closed contracts', () => {
  it('rejects missing, locked, inactive, and non-Admin actors inside lockUser', async () => {
    const targetId = new mongoose.Types.ObjectId().toString();
    await expectAuthError(
      lockUser(new mongoose.Types.ObjectId().toString(), targetId),
      401,
      'AUTH_UNAUTHORIZED',
      'AIP-55 contract: lockUser rechecks that the Admin exists'
    );

    const locked = await createUserFixture({ role: 'ADMIN', status: 'LOCKED' });
    await expectAuthError(
      lockUser(locked.user._id.toString(), targetId),
      403,
      'AUTH_ACCOUNT_LOCKED',
      'AIP-55 contract: a locked Admin cannot mutate users'
    );

    const inactive = await createUserFixture({ role: 'ADMIN', status: 'INACTIVE' });
    await expectAuthError(
      lockUser(inactive.user._id.toString(), targetId),
      401,
      'AUTH_UNAUTHORIZED',
      'AIP-55 contract: an inactive Admin cannot mutate users'
    );

    const candidate = await createUserFixture();
    await expectAuthError(
      lockUser(candidate.user._id.toString(), targetId),
      403,
      'AUTH_FORBIDDEN',
      'AIP-55 contract: service authorization cannot rely only on route middleware'
    );
  });

  it('rejects malformed, missing, locked, and inactive users inside changePassword', async () => {
    await expectAuthError(
      changePassword('not-an-object-id', 'CurrentPass123', 'NextPassword123'),
      401,
      'AUTH_UNAUTHORIZED',
      'AIP-55 contract: malformed authenticated IDs fail closed'
    );
    await expectAuthError(
      changePassword(new mongoose.Types.ObjectId().toString(), 'CurrentPass123', 'NextPassword123'),
      401,
      'AUTH_UNAUTHORIZED',
      'AIP-55 contract: missing users cannot change passwords'
    );

    for (const status of ['LOCKED', 'INACTIVE'] as const) {
      const fixture = await createUserFixture({ status });
      await expectAuthError(
        changePassword(fixture.user._id.toString(), fixture.password, 'NextPassword123'),
        status === 'LOCKED' ? 403 : 401,
        status === 'LOCKED' ? 'AUTH_ACCOUNT_LOCKED' : 'AUTH_UNAUTHORIZED',
        `AIP-55 contract: ${status} users cannot change passwords`
      );
    }
  });
});

describe('AIP-55 middleware authorization branches', () => {
  const createMiddlewareApp = (user?: UserFixture['user']) => {
    const middlewareApp = express();
    middlewareApp.use((req, _res, next) => {
      if (user) req.user = user;
      next();
    });
    middlewareApp.get('/admin', authorize('ADMIN'), (_req, res) => res.json({ success: true }));
    middlewareApp.get(
      '/owner',
      requireOwnership(async () => ({ ownerId: new mongoose.Types.ObjectId() })),
      (_req, res) => res.json({ success: true })
    );
    middlewareApp.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
      res.status(error.statusCode ?? 500).json({ code: error.code });
    });
    return middlewareApp;
  };

  it('fails closed when RBAC or ownership middleware is used without authentication', async () => {
    const middlewareApp = createMiddlewareApp();
    const [rbac, ownership] = await Promise.all([
      request(middlewareApp).get('/admin'),
      request(middlewareApp).get('/owner'),
    ]);
    expect([rbac.status, ownership.status]).toEqual([401, 401]);
    expect([rbac.body.code, ownership.body.code]).toEqual(['AUTH_UNAUTHORIZED', 'AUTH_UNAUTHORIZED']);
  });

  it('rechecks locked and inactive live user status inside RBAC middleware', async () => {
    const locked = await createUserFixture({ role: 'ADMIN', status: 'LOCKED' });
    const inactive = await createUserFixture({ role: 'ADMIN', status: 'INACTIVE' });
    const [lockedResponse, inactiveResponse] = await Promise.all([
      request(createMiddlewareApp(locked.user)).get('/admin'),
      request(createMiddlewareApp(inactive.user)).get('/admin'),
    ]);
    expect(lockedResponse).toMatchObject({ status: 403, body: { code: 'AUTH_ACCOUNT_LOCKED' } });
    expect(inactiveResponse).toMatchObject({ status: 401, body: { code: 'AUTH_UNAUTHORIZED' } });
  });
});
