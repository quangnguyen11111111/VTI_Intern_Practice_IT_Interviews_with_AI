import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import User from '../models/user.model';
import { verifyAccessToken } from '../utils/token';
import { AppError } from '../utils/AppError';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(
        new AppError('Không tìm thấy access token xác thực', 401, 'AUTH_UNAUTHORIZED')
      );
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next(
        new AppError('Access token không hợp lệ', 401, 'AUTH_UNAUTHORIZED')
      );
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(
        new AppError('Access token không hợp lệ hoặc đã hết hạn', 401, 'AUTH_UNAUTHORIZED')
      );
    }

    if (!mongoose.isObjectIdOrHexString(payload.sub)) {
      return next(
        new AppError('Access token không hợp lệ', 401, 'AUTH_UNAUTHORIZED')
      );
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return next(
        new AppError('Người dùng không tồn tại', 401, 'AUTH_UNAUTHORIZED')
      );
    }

    if (user.status === 'LOCKED') {
      return next(
        new AppError('Tài khoản đã bị khóa', 403, 'AUTH_ACCOUNT_LOCKED')
      );
    }

    if (user.status !== 'ACTIVE') {
      return next(
        new AppError('Tài khoản không hoạt động', 401, 'AUTH_UNAUTHORIZED')
      );
    }

    req.user = user;
    req.tokenPayload = payload;

    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (
  ...roles: Array<'CANDIDATE' | 'INTERVIEWER' | 'ADMIN'>
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new AppError('Yêu cầu xác thực', 401, 'AUTH_UNAUTHORIZED')
      );
    }

    if (req.user.status === 'LOCKED') {
      return next(
        new AppError('Tài khoản đã bị khóa', 403, 'AUTH_ACCOUNT_LOCKED')
      );
    }

    if (req.user.status !== 'ACTIVE') {
      return next(
        new AppError('Tài khoản không hoạt động', 401, 'AUTH_UNAUTHORIZED')
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Bạn không có quyền thực hiện hành động này', 403, 'AUTH_FORBIDDEN')
      );
    }

    next();
  };
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  return authorize('ADMIN')(req, res, next);
};

export {
  requireOwnership,
  OwnerResolver,
  OwnerResolverResult,
  OwnershipResolution,
  RequireOwnershipOptions,
} from './ownership.middleware';
