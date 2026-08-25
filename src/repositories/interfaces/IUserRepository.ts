import { IUser } from '../../models/user.model';
import { IBaseRepository } from './IBaseRepository';

export interface IUserRepository
  extends IBaseRepository<IUser> {
  findAdminUsers(
    filter: Record<string, unknown>,
    options?: {
      skip?: number;
      limit?: number;
      sort?: Record<string, 1 | -1>;
    }
  ): Promise<IUser[]>;

  countAdminUsers(
    filter: Record<string, unknown>
  ): Promise<number>;
}