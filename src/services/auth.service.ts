import crypto from 'crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/user.model';
import RefreshToken from '../models/refresh-token.model';
import PasswordResetOtp from '../models/password-reset-otp.model';
import PasswordResetRateLimit from '../models/password-reset-rate-limit.model';
import { emailService } from './email.service';
import { getEnv } from '../config/env';
import {
  generateAuthTokens,
  getRefreshTokenExpiry,
  hashToken,
  verifyRefreshToken,
} from '../utils/token';
import { AppError } from '../utils/AppError';
import { SafeUser, AuthResponseData, JwtTokenPayload } from '../types/auth.type';

// Precomputed dummy bcrypt hash (cost 12) for constant-time comparison when email is not found
const DUMMY_HASH = '$2a$12$K1r6fQ9Z2yD0kX4J8nC1Ou9z9qK8jH7gF5d4s3a2P1o0I9u8Y7t6e';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VerifiedRefreshIdentity = JwtTokenPayload & {
  jti: string;
  sessionId: string;
};

const hasValidRefreshIdentity = (
  payload: JwtTokenPayload
): payload is VerifiedRefreshIdentity => {
  return (
    mongoose.isObjectIdOrHexString(payload.sub) &&
    typeof payload.jti === 'string' &&
    UUID_PATTERN.test(payload.jti) &&
    typeof payload.sessionId === 'string' &&
    UUID_PATTERN.test(payload.sessionId)
  );
};

export const formatSafeUser = (user: IUser): SafeUser => {
  return {
    id: user._id.toString(),
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  };
};

export const registerUser = async (data: {
  email: string;
  password: string;
  fullName: string;
}): Promise<AuthResponseData> => {
  const normalizedEmail = data.email.trim().toLowerCase();

  // Kiểm tra email đã tồn tại hay chưa
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new AppError('Email đã được sử dụng', 409, 'AUTH_EMAIL_ALREADY_EXISTS');
  }

  const env = getEnv();
  const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);

  let responseData: AuthResponseData | null = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const duplicateUser = await User.findOne({ email: normalizedEmail }).session(session);
      if (duplicateUser) {
        throw new AppError('Email đã được sử dụng', 409, 'AUTH_EMAIL_ALREADY_EXISTS');
      }

      // Đăng ký công khai luôn gán role = CANDIDATE, status = ACTIVE, authVersion = 0, credentialVersion = 0
      const users = await User.create(
        [
          {
            email: normalizedEmail,
            passwordHash,
            fullName: data.fullName.trim(),
            role: 'CANDIDATE',
            status: 'ACTIVE',
            authVersion: 0,
            credentialVersion: 0,
          },
        ],
        { session }
      );
      const createdUser = users[0];

      const safeUser = formatSafeUser(createdUser);
      const tokenData = generateAuthTokens(
        safeUser.id,
        safeUser.role,
        undefined,
        undefined,
        createdUser.credentialVersion ?? 0
      );

      const expiresAt = getRefreshTokenExpiry(tokenData.refreshToken);

      await RefreshToken.create(
        [
          {
            userId: createdUser._id,
            sessionId: tokenData.sessionId,
            tokenHash: hashToken(tokenData.refreshToken),
            jti: tokenData.jti,
            isRevoked: false,
            expiresAt,
          },
        ],
        { session }
      );

      responseData = {
        user: safeUser,
        tokens: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
        },
      };
    });
  } finally {
    await session.endSession();
  }

  if (!responseData) {
    throw new AppError('Đăng ký thất bại', 500, 'INTERNAL_SERVER_ERROR');
  }

  return responseData;
};

export const loginUser = async (data: {
  email: string;
  password: string;
}): Promise<AuthResponseData> => {
  const normalizedEmail = data.email.trim().toLowerCase();

  // Tìm user và chọn chủ động passwordHash
  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    // Chạy dummy compare để giảm khác biệt timing khi email không tồn tại
    try {
      await bcrypt.compare(data.password, DUMMY_HASH);
    } catch {
      // Bỏ qua lỗi dummy hash nếu có
    }
    throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const isPasswordMatch = await bcrypt.compare(data.password, user.passwordHash);
  if (!isPasswordMatch) {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  if (user.status === 'LOCKED') {
    throw new AppError('Tài khoản đã bị khóa', 403, 'AUTH_ACCOUNT_LOCKED');
  }

  // User không ACTIVE không được phép đăng nhập, dùng chung mã lỗi để không lộ trạng thái
  if (user.status !== 'ACTIVE') {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  let responseData: AuthResponseData | null = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Tăng authVersion để serialize các phiên đăng nhập và kiểm tra ACTIVE
      const freshUser = await User.findOneAndUpdate(
        { _id: user._id, status: 'ACTIVE' },
        { $inc: { authVersion: 1 } },
        { session, returnDocument: 'after' }
      );

      if (!freshUser) {
        const checkUser = await User.findById(user._id).session(session);
        if (checkUser?.status === 'LOCKED') {
          throw new AppError('Tài khoản đã bị khóa', 403, 'AUTH_ACCOUNT_LOCKED');
        }
        throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'AUTH_INVALID_CREDENTIALS');
      }

      const safeUser = formatSafeUser(freshUser);
      const tokenData = generateAuthTokens(
        safeUser.id,
        safeUser.role,
        undefined,
        undefined,
        freshUser.credentialVersion ?? 0
      );

      const expiresAt = getRefreshTokenExpiry(tokenData.refreshToken);

      await RefreshToken.create(
        [
          {
            userId: freshUser._id,
            sessionId: tokenData.sessionId,
            tokenHash: hashToken(tokenData.refreshToken),
            jti: tokenData.jti,
            isRevoked: false,
            expiresAt,
          },
        ],
        { session }
      );

      responseData = {
        user: safeUser,
        tokens: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
        },
      };
    });
  } finally {
    await session.endSession();
  }

  if (!responseData) {
    throw new AppError('Đăng nhập thất bại', 500, 'INTERNAL_SERVER_ERROR');
  }

  return responseData;
};

export const refreshAuthTokens = async (
  rawRefreshToken: string
): Promise<AuthResponseData> => {
  let payload: JwtTokenPayload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401, 'AUTH_INVALID_REFRESH_TOKEN');
  }

  if (!hasValidRefreshIdentity(payload)) {
    throw new AppError('Refresh token không hợp lệ', 401, 'AUTH_INVALID_REFRESH_TOKEN');
  }

  const computedTokenHash = hashToken(rawRefreshToken);

  let responseData: AuthResponseData | null = null;
  let customErrorToThrow: AppError | null = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(payload.sub).session(session);
      if (!user) {
        throw new AppError('Người dùng không tồn tại', 401, 'AUTH_UNAUTHORIZED');
      }

      // Kiểm tra LOCKED trước để nhất quán trả về 403 AUTH_ACCOUNT_LOCKED
      if (user.status === 'LOCKED') {
        await RefreshToken.updateMany(
          { userId: user._id, isRevoked: false },
          { isRevoked: true, revokedAt: new Date() },
          { session }
        );
        throw new AppError('Tài khoản đã bị khóa', 403, 'AUTH_ACCOUNT_LOCKED');
      }

      if (user.status !== 'ACTIVE') {
        throw new AppError('Tài khoản không hoạt động', 401, 'AUTH_UNAUTHORIZED');
      }

      if (payload.credentialVersion !== (user.credentialVersion ?? 0)) {
        throw new AppError(
          'Refresh token không hợp lệ hoặc đã hết hạn',
          401,
          'AUTH_INVALID_REFRESH_TOKEN'
        );
      }

      // Bắt buộc tra cứu bằng toàn bộ jti, tokenHash, userId và sessionId
      const existingSession = await RefreshToken.findOne({
        jti: payload.jti,
        tokenHash: computedTokenHash,
        userId: user._id,
        sessionId: payload.sessionId,
      }).session(session);

      if (!existingSession) {
        throw new AppError('Refresh token không hợp lệ hoặc không tồn tại', 401, 'AUTH_INVALID_REFRESH_TOKEN');
      }

      if (existingSession.isRevoked) {
        // Reuse detected! Thu hồi toàn bộ session trong cùng token family (userId + sessionId)
        await RefreshToken.updateMany(
          { userId: user._id, sessionId: payload.sessionId, isRevoked: false },
          { isRevoked: true, revokedAt: new Date() },
          { session }
        );
        await User.updateOne(
          { _id: user._id },
          { $inc: { authVersion: 1 } },
          { session }
        );
        customErrorToThrow = new AppError(
          'Refresh token đã bị thu hồi. Phát hiện dấu hiệu tái sử dụng token',
          401,
          'AUTH_TOKEN_REVOKED'
        );
        return;
      }

      if (existingSession.expiresAt < new Date()) {
        throw new AppError('Refresh token đã hết hạn', 401, 'AUTH_EXPIRED_REFRESH_TOKEN');
      }

      // Atomically thu hồi token cũ
      const updatedSession = await RefreshToken.findOneAndUpdate(
        { _id: existingSession._id, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
        { session, returnDocument: 'after' }
      );

      if (!updatedSession) {
        await RefreshToken.updateMany(
          { userId: user._id, sessionId: payload.sessionId, isRevoked: false },
          { isRevoked: true, revokedAt: new Date() },
          { session }
        );
        await User.updateOne(
          { _id: user._id },
          { $inc: { authVersion: 1 } },
          { session }
        );
        customErrorToThrow = new AppError('Refresh token đã bị thu hồi', 401, 'AUTH_TOKEN_REVOKED');
        return;
      }

      // Atomically xác nhận user vẫn ACTIVE và tăng authVersion
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id, status: 'ACTIVE' },
        { $inc: { authVersion: 1 } },
        { session, returnDocument: 'after' }
      );

      if (!updatedUser) {
        const latestUser = await User.findById(user._id).session(session);
        if (latestUser?.status === 'LOCKED') {
          await RefreshToken.updateMany(
            { userId: user._id, isRevoked: false },
            { isRevoked: true, revokedAt: new Date() },
            { session }
          );
          throw new AppError('Tài khoản đã bị khóa', 403, 'AUTH_ACCOUNT_LOCKED');
        }
        throw new AppError('Tài khoản không hoạt động', 401, 'AUTH_UNAUTHORIZED');
      }

      // Cấp cặp token mới cho cùng sessionId với role và credentialVersion hiện tại trong DB
      const tokenData = generateAuthTokens(
        updatedUser._id.toString(),
        updatedUser.role,
        existingSession.sessionId,
        undefined,
        updatedUser.credentialVersion ?? 0
      );

      const expiresAt = getRefreshTokenExpiry(tokenData.refreshToken);

      await RefreshToken.create(
        [
          {
            userId: updatedUser._id,
            sessionId: existingSession.sessionId,
            tokenHash: hashToken(tokenData.refreshToken),
            jti: tokenData.jti,
            isRevoked: false,
            expiresAt,
          },
        ],
        { session }
      );

      responseData = {
        user: formatSafeUser(updatedUser),
        tokens: {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
        },
      };
    });
  } finally {
    await session.endSession();
  }

  if (customErrorToThrow) {
    throw customErrorToThrow;
  }

  if (!responseData) {
    throw new AppError('Làm mới token thất bại', 500, 'INTERNAL_SERVER_ERROR');
  }

  return responseData;
};

export const logoutUser = async (rawRefreshToken: string): Promise<void> => {
  let payload: JwtTokenPayload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401, 'AUTH_INVALID_REFRESH_TOKEN');
  }

  if (!hasValidRefreshIdentity(payload)) {
    throw new AppError('Refresh token không hợp lệ', 401, 'AUTH_INVALID_REFRESH_TOKEN');
  }

  const tokenHash = hashToken(rawRefreshToken);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const user = await User.findById(payload.sub).session(session);
      if (!user) {
        throw new AppError('Người dùng không tồn tại', 401, 'AUTH_UNAUTHORIZED');
      }

      // Bắt buộc tra cứu bằng toàn bộ jti, tokenHash, userId và sessionId
      const existingSession = await RefreshToken.findOne({
        jti: payload.jti,
        tokenHash,
        userId: user._id,
        sessionId: payload.sessionId,
      }).session(session);

      if (!existingSession || existingSession.isRevoked) {
        throw new AppError('Phiên đăng nhập không tồn tại hoặc đã bị thu hồi', 401, 'AUTH_INVALID_REFRESH_TOKEN');
      }

      // Atomically thu hồi đúng phiên đăng nhập này
      const updatedSession = await RefreshToken.findOneAndUpdate(
        { _id: existingSession._id, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
        { session, returnDocument: 'after' }
      );

      if (!updatedSession) {
        throw new AppError('Phiên đăng nhập không tồn tại hoặc đã bị thu hồi', 401, 'AUTH_INVALID_REFRESH_TOKEN');
      }

      await User.updateOne(
        { _id: user._id },
        { $inc: { authVersion: 1 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
};

export const lockUser = async (
  adminUserId: string,
  targetUserId: string
): Promise<SafeUser> => {
  if (adminUserId === targetUserId) {
    throw new AppError('Không thể tự khóa tài khoản của chính mình', 400, 'AUTH_CANNOT_LOCK_SELF');
  }

  let updatedTargetUser: IUser | null = null;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const currentAdmin = await User.findById(adminUserId).session(session);
      if (!currentAdmin) {
        throw new AppError('Người dùng không tồn tại', 401, 'AUTH_UNAUTHORIZED');
      }
      if (currentAdmin.status === 'LOCKED') {
        throw new AppError('Tài khoản đã bị khóa', 403, 'AUTH_ACCOUNT_LOCKED');
      }
      if (currentAdmin.status !== 'ACTIVE') {
        throw new AppError('Tài khoản không hoạt động', 401, 'AUTH_UNAUTHORIZED');
      }
      if (currentAdmin.role !== 'ADMIN') {
        throw new AppError('Bạn không có quyền thực hiện hành động này', 403, 'AUTH_FORBIDDEN');
      }

      const targetUser = await User.findById(targetUserId).session(session);
      if (!targetUser) {
        throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND');
      }

      updatedTargetUser = await User.findByIdAndUpdate(
        targetUserId,
        { status: 'LOCKED', $inc: { authVersion: 1, credentialVersion: 1 } },
        { session, returnDocument: 'after' }
      );

      // Thu hồi toàn bộ refresh sessions của user bị khóa
      await RefreshToken.updateMany(
        { userId: targetUser._id, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  if (!updatedTargetUser) {
    throw new AppError('Người dùng không tồn tại', 404, 'AUTH_USER_NOT_FOUND');
  }

  return formatSafeUser(updatedTargetUser);
};

export const hashEmail = (email: string): string => {
  const env = getEnv();
  const normalized = email.trim().toLowerCase();
  return crypto.createHmac('sha256', env.PASSWORD_RESET_SECRET).update(normalized).digest('hex');
};

export const hashOtp = (otp: string): string => {
  const env = getEnv();
  return crypto.createHmac('sha256', env.PASSWORD_RESET_SECRET).update(otp.trim()).digest('hex');
};

export const generateSecureOtp = (): string => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  if (!mongoose.isObjectIdOrHexString(userId)) {
    throw new AppError('Yêu cầu xác thực', 401, 'AUTH_UNAUTHORIZED');
  }

  const user = await User.findById(userId).select('+passwordHash');
  if (!user) {
    throw new AppError('Người dùng không tồn tại', 401, 'AUTH_UNAUTHORIZED');
  }

  if (user.status === 'LOCKED') {
    throw new AppError('Tài khoản đã bị khóa', 403, 'AUTH_ACCOUNT_LOCKED');
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('Tài khoản không hoạt động', 401, 'AUTH_UNAUTHORIZED');
  }

  const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentPasswordCorrect) {
    throw new AppError('Mật khẩu hiện tại không chính xác', 400, 'AUTH_INVALID_CURRENT_PASSWORD');
  }

  const isReusingOldPassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isReusingOldPassword) {
    throw new AppError('Mật khẩu mới không được trùng với mật khẩu hiện tại', 400, 'AUTH_PASSWORD_REUSED');
  }

  const env = getEnv();
  const newPasswordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id, status: 'ACTIVE', passwordHash: user.passwordHash },
        { passwordHash: newPasswordHash, $inc: { authVersion: 1, credentialVersion: 1 } },
        { session, returnDocument: 'after' }
      );

      if (!updatedUser) {
        const latestUser = await User.findById(user._id).session(session).select('+passwordHash');
        if (!latestUser || latestUser.status !== 'ACTIVE') {
          throw new AppError('Tài khoản không hoạt động', 401, 'AUTH_UNAUTHORIZED');
        }
        throw new AppError(
          'Mật khẩu đã được thay đổi bởi một yêu cầu khác. Vui lòng thử lại.',
          409,
          'AUTH_PASSWORD_CHANGED'
        );
      }

      await RefreshToken.updateMany(
        { userId: user._id, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
};

export const acquirePasswordResetReservation = async (
  emailHmac: string,
  now: Date
): Promise<{ acquired: boolean; reservationId?: string }> => {
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const reservationId = crypto.randomUUID();
  const cooldownExpiresAt = new Date(now.getTime() + 60 * 1000);
  const reservationExpiresAt = new Date(now.getTime() + 60 * 1000);
  const purgeAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // 1. Ensure document exists
  try {
    await PasswordResetRateLimit.updateOne(
      { emailHash: emailHmac },
      {
        $setOnInsert: {
          emailHash: emailHmac,
          requestTimestamps: [],
          cooldownExpiresAt: null,
          reservationId: null,
          reservationExpiresAt: null,
          purgeAt,
        },
      },
      { upsert: true }
    );
  } catch (err: any) {
    if (err.code !== 11000) {
      throw err;
    }
  }

  // 2. Prune old timestamps past rolling hour
  await PasswordResetRateLimit.updateOne(
    { emailHash: emailHmac },
    { $pull: { requestTimestamps: { $lt: oneHourAgo } } }
  );

  // 3. Check current state before attempting atomic reservation
  const currentRecord = await PasswordResetRateLimit.findOne({ emailHash: emailHmac });
  if (currentRecord) {
    const recentTimestamps = currentRecord.requestTimestamps.filter(
      (ts) => ts >= oneHourAgo
    );
    if (recentTimestamps.length >= 5) {
      throw new AppError(
        'Bạn đã yêu cầu đặt lại mật khẩu quá số lần cho phép trong 1 giờ. Vui lòng thử lại sau.',
        429,
        'AUTH_TOO_MANY_REQUESTS'
      );
    }

    const isCooldownActive =
      currentRecord.cooldownExpiresAt && currentRecord.cooldownExpiresAt > now;
    const isReservationActive =
      currentRecord.reservationExpiresAt && currentRecord.reservationExpiresAt > now;

    if (isCooldownActive || isReservationActive) {
      return { acquired: false };
    }
  }

  // 4. Atomic conditional reservation
  const updated = await PasswordResetRateLimit.findOneAndUpdate(
    {
      emailHash: emailHmac,
      $and: [
        {
          $or: [
            { cooldownExpiresAt: null },
            { cooldownExpiresAt: { $lte: now } },
          ],
        },
        {
          $or: [
            { reservationExpiresAt: null },
            { reservationExpiresAt: { $lte: now } },
          ],
        },
        {
          $expr: {
            $lt: [
              {
                $size: {
                  $filter: {
                    input: '$requestTimestamps',
                    as: 'ts',
                    cond: { $gte: ['$$ts', oneHourAgo] },
                  },
                },
              },
              5,
            ],
          },
        },
      ],
    },
    {
      $push: { requestTimestamps: now },
      $set: {
        reservationId,
        reservationExpiresAt,
        cooldownExpiresAt,
        purgeAt,
      },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    // If update failed, determine whether it failed due to hourly cap or cooldown/reservation race
    const checkRecord = await PasswordResetRateLimit.findOne({ emailHash: emailHmac });
    if (checkRecord) {
      const recentTimestamps = checkRecord.requestTimestamps.filter(
        (ts) => ts >= oneHourAgo
      );
      if (recentTimestamps.length >= 5) {
        throw new AppError(
          'Bạn đã yêu cầu đặt lại mật khẩu quá số lần cho phép trong 1 giờ. Vui lòng thử lại sau.',
          429,
          'AUTH_TOO_MANY_REQUESTS'
        );
      }
    }
    return { acquired: false };
  }

  return { acquired: true, reservationId };
};

export const requestPasswordReset = async (rawEmail: string): Promise<void> => {
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const emailHmac = hashEmail(normalizedEmail);
  const now = new Date();

  let reservationId: string | undefined;

  try {
    const reservation = await acquirePasswordResetReservation(emailHmac, now);
    if (!reservation.acquired) {
      return;
    }
    reservationId = reservation.reservationId;

    const user = await User.findOne({ email: normalizedEmail });
    const isSynthetic = !user || user.status === 'LOCKED' || user.status === 'INACTIVE';
    const userId = !isSynthetic && user ? user._id : null;

    const rawOtp = generateSecureOtp();
    const otpHmac = hashOtp(rawOtp);

    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const purgeAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const otpRecord = await PasswordResetOtp.create({
      emailHash: emailHmac,
      otpHash: otpHmac,
      userId,
      isSynthetic,
      attempts: 0,
      deliveryState: 'PENDING',
      usedAt: null,
      expiresAt,
      purgeAt,
    });

    try {
      await emailService.sendPasswordResetOtp(normalizedEmail, rawOtp, isSynthetic);
      await PasswordResetOtp.updateOne(
        { _id: otpRecord._id },
        { deliveryState: 'SENT' }
      );
      await PasswordResetRateLimit.updateOne(
        { emailHash: emailHmac, reservationId },
        { $set: { reservationId: null, reservationExpiresAt: null } }
      );
    } catch (error) {
      await PasswordResetOtp.updateOne(
        { _id: otpRecord._id },
        { deliveryState: 'FAILED', expiresAt: new Date() }
      );
      await PasswordResetRateLimit.updateOne(
        { emailHash: emailHmac, reservationId },
        {
          $set: {
            reservationId: null,
            reservationExpiresAt: null,
            cooldownExpiresAt: null,
          },
        }
      );
      throw new AppError(
        'Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.',
        503,
        'AUTH_EMAIL_DELIVERY_FAILED'
      );
    }
  } catch (error) {
    if (
      reservationId &&
      !(error instanceof AppError && error.code === 'AUTH_EMAIL_DELIVERY_FAILED')
    ) {
      await PasswordResetRateLimit.updateOne(
        { emailHash: emailHmac, reservationId },
        {
          $set: {
            reservationId: null,
            reservationExpiresAt: null,
            cooldownExpiresAt: null,
          },
        }
      );
    }
    throw error;
  }
};

export const resetPassword = async (
  rawEmail: string,
  rawOtp: string,
  newPassword: string
): Promise<void> => {
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const emailHmac = hashEmail(normalizedEmail);
  const otpHmac = hashOtp(rawOtp.trim());
  const now = new Date();

  const CANONICAL_ERROR_MSG = 'Mã xác thực không hợp lệ hoặc đã hết hạn';
  const CANONICAL_ERROR_CODE = 'AUTH_INVALID_OR_EXPIRED_OTP';

  const record = await PasswordResetOtp.findOne({
    emailHash: emailHmac,
    usedAt: null,
  }).sort({ createdAt: -1 });

  if (!record) {
    throw new AppError(CANONICAL_ERROR_MSG, 400, CANONICAL_ERROR_CODE);
  }

  if (record.expiresAt < now || record.attempts >= 5 || record.deliveryState !== 'SENT') {
    throw new AppError(CANONICAL_ERROR_MSG, 400, CANONICAL_ERROR_CODE);
  }

  const recordBuf = Buffer.from(record.otpHash, 'hex');
  const inputBuf = Buffer.from(otpHmac, 'hex');
  const isMatch = recordBuf.length === inputBuf.length && crypto.timingSafeEqual(recordBuf, inputBuf);

  if (!isMatch) {
    await PasswordResetOtp.updateOne(
      { _id: record._id, usedAt: null, attempts: { $lt: 5 } },
      { $inc: { attempts: 1 } }
    );
    throw new AppError(CANONICAL_ERROR_MSG, 400, CANONICAL_ERROR_CODE);
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const consumedRecord = await PasswordResetOtp.findOneAndUpdate(
        {
          _id: record._id,
          usedAt: null,
          attempts: { $lt: 5 },
          expiresAt: { $gt: new Date() },
          deliveryState: 'SENT',
        },
        { $set: { usedAt: new Date() } },
        { session, returnDocument: 'after' }
      );

      if (!consumedRecord) {
        throw new AppError(CANONICAL_ERROR_MSG, 400, CANONICAL_ERROR_CODE);
      }

      if (consumedRecord.isSynthetic || !consumedRecord.userId) {
        return;
      }

      const env = getEnv();
      const newPasswordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);

      const user = await User.findOneAndUpdate(
        { _id: consumedRecord.userId, status: 'ACTIVE' },
        { passwordHash: newPasswordHash, $inc: { authVersion: 1, credentialVersion: 1 } },
        { session, returnDocument: 'after' }
      );

      if (user) {
        await RefreshToken.updateMany(
          { userId: user._id, isRevoked: false },
          { isRevoked: true, revokedAt: new Date() },
          { session }
        );
      }
    });
  } finally {
    await session.endSession();
  }
};
