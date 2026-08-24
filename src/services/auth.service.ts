import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/user.model';
import RefreshToken from '../models/refresh-token.model';
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

      // Đăng ký công khai luôn gán role = CANDIDATE và status = ACTIVE
      const users = await User.create(
        [
          {
            email: normalizedEmail,
            passwordHash,
            fullName: data.fullName.trim(),
            role: 'CANDIDATE',
            status: 'ACTIVE',
            authVersion: 0,
          },
        ],
        { session }
      );
      const createdUser = users[0];

      const safeUser = formatSafeUser(createdUser);
      const tokenData = generateAuthTokens(safeUser.id, safeUser.role);

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
      const tokenData = generateAuthTokens(safeUser.id, safeUser.role);

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

      // Cấp cặp token mới cho cùng sessionId với role hiện tại trong DB
      const tokenData = generateAuthTokens(
        updatedUser._id.toString(),
        updatedUser.role,
        existingSession.sessionId
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
        { status: 'LOCKED', $inc: { authVersion: 1 } },
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
