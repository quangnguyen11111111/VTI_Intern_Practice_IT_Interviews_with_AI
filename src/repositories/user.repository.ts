import { injectable } from 'tsyringe';

import User, {
  IUser
} from '../models/user.model';

import { BaseRepository } from './base.repository';

import { IUserRepository } from './interfaces/IUserRepository';

@injectable()
export class UserRepository
  extends BaseRepository<IUser>
  implements IUserRepository
{
  constructor() {
    super(User);
  }

  async findAdminUsers(
    filter: Record<string, unknown>,
    options?: {
      skip?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    }
  ): Promise<IUser[]> {
    return this.find(filter, {
      skip: options?.skip,
      limit: options?.limit,
      sort: options?.sort ?? {
        createdAt: -1
      }
    });
  }

  async countAdminUsers(
    filter: Record<string, unknown>
  ): Promise<number> {
    return this.count(filter);
  }
}