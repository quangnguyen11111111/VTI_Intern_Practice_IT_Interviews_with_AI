export type UserRole =
  | 'CANDIDATE'
  | 'INTERVIEWER'
  | 'ADMIN';

export type UserStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'LOCKED';

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: UserStatus;
}

export interface GetUsersResponse {
  users: AdminUser[];
  pagination: Pagination;
}

export type UserAction = 'LOCK' | 'UNLOCK';