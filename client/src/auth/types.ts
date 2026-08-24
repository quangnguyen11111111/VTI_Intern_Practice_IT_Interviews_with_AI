export type Role = 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface ApiError {
  message: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  status?: number;
}

export const toApiError = (error: unknown): ApiError => {
  if (
    error !== null &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error as ApiError;
  }

  return { message: 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.' };
};
