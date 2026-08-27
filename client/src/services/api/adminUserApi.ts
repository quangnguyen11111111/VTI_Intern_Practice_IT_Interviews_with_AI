import type {
  AdminUser,
  GetUsersParams,
  GetUsersResponse
} from '../../features/AdminUserManagement/types';
import { request } from '../../auth/apiClient';

interface AdminUserApiItem {
  id: string;
  email: string;
  fullName: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

interface AdminUserListData {
  users: AdminUserApiItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const buildQuery = (
  params: GetUsersParams
): string => {
  const searchParams = new URLSearchParams();

  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }

  if (params.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  if (params.search?.trim()) {
    searchParams.set('search', params.search.trim());
  }

  if (params.status) {
    searchParams.set('status', params.status);
  }

  const query = searchParams.toString();

  return query ? `?${query}` : '';
};

const mapUser = (
  user: AdminUserApiItem
): AdminUser => ({
  _id: user.id,
  name: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

export const adminUserApi = {
  getUsers: async (
    params: GetUsersParams = {}
  ): Promise<GetUsersResponse> => {
    const data = await request<AdminUserListData>(
      `admin/users${buildQuery(params)}`
    );

    return {
      users: data.users.map(mapUser),
      pagination: data.pagination
    };
  },

  lockUser: async (
    userId: string
  ): Promise<AdminUser> => {
    const data = await request<AdminUserApiItem>(
      `admin/users/${userId}/lock`,
      {
        method: 'PATCH'
      }
    );

    return mapUser(data);
  },

  unlockUser: async (
    userId: string
  ): Promise<AdminUser> => {
    const data = await request<AdminUserApiItem>(
      `admin/users/${userId}/unlock`,
      {
        method: 'PATCH'
      }
    );

    return mapUser(data);
  }
};