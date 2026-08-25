import { injectable, inject } from 'tsyringe';

import { IUser } from '../models/user.model';
import { AppError } from '../utils/AppError';

import {
  IAdminUserService,
  AdminUserListQuery,
  AdminUserListResult
} from './interfaces/IAdminUserService';

import { IUserRepository } from '../repositories/interfaces/IUserRepository';
import {
  IAuditService,
  CreateAuditLogInput
} from './interfaces/IAuditService';

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
    actorId: string
  ): Promise<IUser> {
    try {
      const user =
        await this.userRepository.findById(
          userId
        );

      if (!user) {
        await this.recordFailureAudit(
          actorId,
          userId,
          'LOCK_USER'
        );

        throw new AppError(
          'User không tồn tại',
          404
        );
      }

      if (userId === actorId) {
        await this.recordFailureAudit(
          actorId,
          userId,
          'LOCK_USER'
        );

        throw new AppError(
          'Admin không thể tự khóa tài khoản',
          400
        );
      }

      // Idempotent
      if (user.status === 'LOCKED') {
        return user;
      }

      const updatedUser =
        await this.userRepository.update(
          userId,
          {
            status: 'LOCKED'
          }
        );

      if (!updatedUser) {
        await this.recordFailureAudit(
          actorId,
          userId,
          'LOCK_USER'
        );

        throw new AppError(
          'User không tồn tại',
          404
        );
      }

      await this.recordAudit({
        actor: actorId,
        target: userId,
        action: 'LOCK_USER',
        outcome: 'SUCCESS'
      });

      return updatedUser;
    } catch (error) {
      /*
       * Các business errors đã được audit
       * ở nơi phát sinh.
       *
       * Các lỗi ngoài dự kiến sẽ được audit
       * là FAILURE trước khi trả lỗi ra ngoài.
       */
      if (
        error instanceof AppError &&
        (
          error.message === 'User không tồn tại' ||
          error.message ===
            'Admin không thể tự khóa tài khoản'
        )
      ) {
        throw error;
      }

      await this.recordFailureAudit(
        actorId,
        userId,
        'LOCK_USER'
      );

      throw error;
    }
  }

  async unlockUser(
    userId: string,
    actorId: string
  ): Promise<IUser> {
    try {
      const user =
        await this.userRepository.findById(
          userId
        );

      if (!user) {
        await this.recordFailureAudit(
          actorId,
          userId,
          'UNLOCK_USER'
        );

        throw new AppError(
          'User không tồn tại',
          404
        );
      }

      // Idempotent
      if (user.status === 'ACTIVE') {
        return user;
      }

      const updatedUser =
        await this.userRepository.update(
          userId,
          {
            status: 'ACTIVE'
          }
        );

      if (!updatedUser) {
        await this.recordFailureAudit(
          actorId,
          userId,
          'UNLOCK_USER'
        );

        throw new AppError(
          'User không tồn tại',
          404
        );
      }

      await this.recordAudit({
        actor: actorId,
        target: userId,
        action: 'UNLOCK_USER',
        outcome: 'SUCCESS'
      });

      return updatedUser;
    } catch (error) {
      if (
        error instanceof AppError &&
        error.message === 'User không tồn tại'
      ) {
        throw error;
      }

      await this.recordFailureAudit(
        actorId,
        userId,
        'UNLOCK_USER'
      );

      throw error;
    }
  }

  private async recordAudit(
    input: CreateAuditLogInput
  ): Promise<void> {
    try {
      await this.auditService.createAuditLog(
        input
      );
    } catch (auditError) {
      console.error(
        'Audit log failed:',
        auditError
      );
    }
  }

  private async recordFailureAudit(
    actorId: string,
    targetId: string,
    action: 'LOCK_USER' | 'UNLOCK_USER'
  ): Promise<void> {
    await this.recordAudit({
      actor: actorId,
      target: targetId,
      action,
      outcome: 'FAILURE'
    });
  }
}