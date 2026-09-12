import { injectable, inject } from 'tsyringe';

import { IUser } from '../models/user.model';
import { AppError } from '../utils/AppError';

import {
  IAdminUserService,
  AdminUserListQuery,
  AdminUserListResult
} from './interfaces/IAdminUserService';

import { IUserRepository } from '../repositories/interfaces/IUserRepository';
import { IAuditService } from './interfaces/IAuditService';
import { runAuditedMutation } from './audited-mutation';
import RefreshToken from '../models/refresh-token.model';

@injectable()
export class AdminUserService
  implements IAdminUserService
{
  constructor(
    @inject('IUserRepository')
    private readonly userRepository: IUserRepository,

    @inject('IAuditService')
    private readonly auditService: IAuditService
  ) {}

  async getUsers(
    query: AdminUserListQuery
  ): Promise<AdminUserListResult> {
    const {
      page = 1,
      limit = 10,
      search,
      status
    } = query;

    const normalizedPage = Math.max(
      1,
      Number(page)
    );

    const normalizedLimit = Math.min(
      100,
      Math.max(1, Number(limit))
    );

    const filter: Record<string, unknown> = {};

    if (search?.trim()) {
      filter.$or = [
        {
          fullName: {
            $regex: search.trim(),
            $options: 'i'
          }
        },
        {
          email: {
            $regex: search.trim(),
            $options: 'i'
          }
        }
      ];
    }

    if (status) {
      filter.status = status;
    }

    const skip =
      (normalizedPage - 1) *
      normalizedLimit;

    const [
      users,
      total
    ] = await Promise.all([
      this.userRepository.findAdminUsers(
        filter,
        {
          skip,
          limit: normalizedLimit,
          sort: {
            createdAt: -1
          }
        }
      ),

      this.userRepository.countAdminUsers(
        filter
      )
    ]);

    return {
      users: users.map((user) => ({
        id: user._id.toString(),
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      })),
      pagination: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages: Math.ceil(
          total / normalizedLimit
        )
      }
    };
  }

  async lockUser(
    userId: string,
    actorId: string,
    requestId: string,
  ): Promise<IUser> {
    return runAuditedMutation(this.auditService, {
      actorId, targetId: userId, resourceType: 'USER', action: 'LOCK_USER', requestId,
    }, async session => {
      if (userId === actorId) throw new AppError('Admin không thể tự khóa tài khoản', 400, 'AUTH_CANNOT_LOCK_SELF');
      const user = await this.userRepository.findById(userId);
      if (!user) throw new AppError('User không tồn tại', 404, 'AUTH_USER_NOT_FOUND');
      if (user.status === 'LOCKED') return { value: user };
      const value = await this.userRepository.update(userId, {
        status: 'LOCKED',
        $inc: { authVersion: 1, credentialVersion: 1 },
      } as any, session);
      if (!value) throw new AppError('User không tồn tại', 404, 'AUTH_USER_NOT_FOUND');
      await RefreshToken.updateMany(
        { userId: value._id, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
        { session },
      );
      return { value };
    });
  }

  async unlockUser(
    userId: string,
    actorId: string,
    requestId: string,
  ): Promise<IUser> {
    return runAuditedMutation(this.auditService, {
      actorId, targetId: userId, resourceType: 'USER', action: 'UNLOCK_USER', requestId,
    }, async session => {
      const user = await this.userRepository.findById(userId);
      if (!user) throw new AppError('User không tồn tại', 404, 'AUTH_USER_NOT_FOUND');
      if (user.status === 'ACTIVE') return { value: user };
      const value = await this.userRepository.update(userId, { status: 'ACTIVE' }, session);
      if (!value) throw new AppError('User không tồn tại', 404, 'AUTH_USER_NOT_FOUND');
      return { value };
    });
  }
}
