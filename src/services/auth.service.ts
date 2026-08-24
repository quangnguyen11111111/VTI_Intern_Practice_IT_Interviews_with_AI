import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/user.model';
import { getEnv } from '../config/env';
import { generateAuthTokens } from '../utils/token';
import { AppError } from '../utils/AppError';
import { SafeUser, AuthResponseData } from '../types/auth.type';

// Precomputed dummy bcrypt hash (cost 12) for constant-time comparison when email is not found
const DUMMY_HASH = '$2a$12$K1r6fQ9Z2yD0kX4J8nC1Ou9z9qK8jH7gF5d4s3a2P1o0I9u8Y7t6e';

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

  // Đăng ký công khai luôn gán role = CANDIDATE và status = ACTIVE
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    fullName: data.fullName.trim(),
    role: 'CANDIDATE',
    status: 'ACTIVE',
  });

  const safeUser = formatSafeUser(user);
  const tokens = generateAuthTokens(safeUser.id, safeUser.role);

  return {
    user: safeUser,
    tokens,
  };
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

  // User không ACTIVE không được phép đăng nhập, dùng chung mã lỗi để không lộ trạng thái
  if (user.status !== 'ACTIVE') {
    throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'AUTH_INVALID_CREDENTIALS');
  }

  const safeUser = formatSafeUser(user);
  const tokens = generateAuthTokens(safeUser.id, safeUser.role);

  return {
    user: safeUser,
    tokens,
  };
};
