import type {
  AdminUser,
  GetUsersParams,
  GetUsersResponse
} from '../../features/AdminUserManagement/types';

const API_URL = 'http://localhost:3000/api/v1';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

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

const ACTOR_ID = import.meta.env.VITE_ADMIN_ACTOR_ID;

if (!ACTOR_ID) {
  throw new Error('VITE_ADMIN_ACTOR_ID is not configured');
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

const parseError = async (
  response: Response
): Promise<string> => {
  try {
    const body = (await response.json()) as {
      message?: string;
    };

    return (
      body.message ||
      `Request failed with status ${response.status}`
    );
  } catch {
    return `Request failed with status ${response.status}`;
  }
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
    const response = await fetch(
      `${API_URL}/admin/users${buildQuery(params)}`
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const json =
      (await response.json()) as ApiResponse<AdminUserListData>;

    return {
      users: json.data.users.map(mapUser),
      pagination: json.data.pagination
    };
  },

  lockUser: async (
    userId: string
  ): Promise<AdminUser> => {
    const response = await fetch(
      `${API_URL}/admin/users/${userId}/lock`,
      {
        method: 'PATCH',
        headers: {
          'x-actor-id': ACTOR_ID
        }
      }
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const json =
      (await response.json()) as ApiResponse<AdminUserApiItem>;

    return mapUser(json.data);
  },

  unlockUser: async (
    userId: string
  ): Promise<AdminUser> => {
    const response = await fetch(
      `${API_URL}/admin/users/${userId}/unlock`,
      {
        method: 'PATCH',
        headers: {
          'x-actor-id': ACTOR_ID
        }
      }
    );

    if (!response.ok) {
      throw new Error(await parseError(response));
    }

    const json =
      (await response.json()) as ApiResponse<AdminUserApiItem>;

    return mapUser(json.data);
  }
};