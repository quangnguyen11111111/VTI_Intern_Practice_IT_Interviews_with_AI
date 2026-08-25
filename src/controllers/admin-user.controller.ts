import { Request, Response } from 'express';
import { inject, injectable } from 'tsyringe';

import { IAdminUserService } from '../services/interfaces/IAdminUserService';

@injectable()
export class AdminUserController {
  constructor(
    @inject('IAdminUserService')
    private readonly adminUserService: IAdminUserService
  ) {}

  async getUsers(
    req: Request,
    res: Response
  ) {
    const result =
      await this.adminUserService.getUsers({
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 10,
        search:
          typeof req.query.search === 'string'
            ? req.query.search
            : undefined,
        status:
          req.query.status === 'ACTIVE' ||
          req.query.status === 'LOCKED'
            ? req.query.status
            : undefined,
      });

    return res.status(200).json({
      success: true,
      data: result,
    });
  }

  async lockUser(
    req: Request,
    res: Response
  ) {
    const { id } = req.params;

    if (typeof id !== 'string' || !id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const actorId = req.header('x-actor-id');

    if (!actorId) {
      return res.status(400).json({
        success: false,
        message: 'Actor ID is required',
      });
    }

    const user =
      await this.adminUserService.lockUser(
        id,
        actorId
      );

    return res.status(200).json({
      success: true,
      message: 'User locked successfully',
      data: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    });
  }

  async unlockUser(
    req: Request,
    res: Response
  ) {
    const { id } = req.params;

    if (typeof id !== 'string' || !id) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    const actorId = req.header('x-actor-id');

    if (!actorId) {
      return res.status(400).json({
        success: false,
        message: 'Actor ID is required',
      });
    }

    const user =
      await this.adminUserService.unlockUser(
        id,
        actorId
      );

    return res.status(200).json({
      success: true,
      message: 'User unlocked successfully',
      data: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
      },
    });
  }
}