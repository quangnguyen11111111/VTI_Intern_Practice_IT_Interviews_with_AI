import { IUser } from '../../models/user.model';

export interface AdminUserListQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'ACTIVE' | 'LOCKED';
}

export interface AdminUserItem {
  id: string;
  email: string;
  fullName: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUserListResult {
  users: AdminUserItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IAdminUserService {
  getUsers(
    query: AdminUserListQuery
  ): Promise<AdminUserListResult>;

  lockUser(
    userId: string,
    actorId: string
  ): Promise<IUser>;

  unlockUser(
    userId: string,
    actorId: string
  ): Promise<IUser>;
}