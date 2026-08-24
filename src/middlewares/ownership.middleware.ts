import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AppError } from '../utils/AppError';

export interface OwnershipResolution<T = unknown> {
  ownerId: string | mongoose.Types.ObjectId;
  resource?: T;
}

export type OwnerResolverResult<T = unknown> =
  | OwnershipResolution<T>
  | null;

export type OwnerResolver<T = unknown> = (
  req: Request
) => OwnerResolverResult<T> | Promise<OwnerResolverResult<T>>;

export interface RequireOwnershipOptions {
  allowRoles?: Array<'CANDIDATE' | 'INTERVIEWER' | 'ADMIN'>;
  resourceName?: string;
  notFoundMessage?: string;
  notFoundCode?: string;
  attachKey?: string;
}

/**
 * Middleware kiểm tra quyền sở hữu resource dựa trên server-side resolver
 */
export const requireOwnership = <T = unknown>(
  resolveOwner: OwnerResolver<T>,
  options?: RequireOwnershipOptions
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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

      const rawResult = await resolveOwner(req);

      if (rawResult === null || rawResult === undefined) {
        return next(
          new AppError(
            options?.notFoundMessage || `${options?.resourceName || 'Tài nguyên'} không tồn tại`,
            404,
            options?.notFoundCode || 'NOT_FOUND'
          )
        );
      }

      // Validate & canonicalize ownerId TRƯỚC KHI xét role bypass
      if (typeof rawResult !== 'object' || rawResult === null || !('ownerId' in rawResult)) {
        return next(
          new AppError('Không thể xác định quyền sở hữu tài nguyên', 403, 'AUTH_FORBIDDEN')
        );
      }

      const rawOwnerId = (rawResult as unknown as Record<string, unknown>).ownerId;
      let normalizedOwnerId: string;

      if (rawOwnerId instanceof mongoose.Types.ObjectId) {
        normalizedOwnerId = rawOwnerId.toHexString();
      } else if (
        typeof rawOwnerId === 'string' &&
        rawOwnerId.trim().length > 0 &&
        mongoose.isObjectIdOrHexString(rawOwnerId.trim())
      ) {
        try {
          normalizedOwnerId = new mongoose.Types.ObjectId(rawOwnerId.trim()).toHexString();
        } catch {
          return next(
            new AppError('Không thể xác định quyền sở hữu tài nguyên', 403, 'AUTH_FORBIDDEN')
          );
        }
      } else {
        return next(
          new AppError('Không thể xác định quyền sở hữu tài nguyên', 403, 'AUTH_FORBIDDEN')
        );
      }

      const resource = (rawResult as OwnershipResolution<T>).resource;

      // Check role bypass nếu được định cấu hình rõ ràng (chỉ chạy sau khi ownerId đã hợp lệ và resource đã tìm thấy)
      if (options?.allowRoles && options.allowRoles.includes(req.user.role)) {
        if (resource !== undefined) {
          const attachKey = options?.attachKey || 'resource';
          res.locals[attachKey] = resource;
          req.resource = resource;
        }
        return next();
      }

      const currentUserId = (
        req.user._id instanceof mongoose.Types.ObjectId
          ? req.user._id
          : new mongoose.Types.ObjectId(req.user._id)
      ).toHexString();

      if (normalizedOwnerId !== currentUserId) {
        return next(
          new AppError('Bạn không có quyền truy cập tài nguyên này', 403, 'AUTH_FORBIDDEN')
        );
      }

      if (resource !== undefined) {
        const attachKey = options?.attachKey || 'resource';
        res.locals[attachKey] = resource;
        req.resource = resource;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
