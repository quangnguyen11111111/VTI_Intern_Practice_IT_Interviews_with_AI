export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  avatarUrl?: string | null;
  currentLevel?: 'FRESHER' | 'JUNIOR' | 'MIDDLE' | 'SENIOR' | 'LEAD' | 'MANAGER' | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  bio?: string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponseData {
  user: SafeUser;
  tokens: AuthTokens;
}

export interface JwtTokenPayload {
  sub: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';
  type: 'access' | 'refresh';
  credentialVersion: number;
  jti?: string;
  sessionId?: string;
}
