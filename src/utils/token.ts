import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env';
import { JwtTokenPayload, AuthTokens } from '../types/auth.type';

const VALID_ROLES = new Set(['CANDIDATE', 'INTERVIEWER', 'ADMIN']);

export const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const getRefreshTokenExpiry = (token: string): Date => {
  const decoded = jwt.decode(token);

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof decoded.exp !== 'number' ||
    !Number.isFinite(decoded.exp)
  ) {
    throw new Error('Generated refresh token is missing a valid expiration');
  }

  return new Date(decoded.exp * 1000);
};

export const generateAuthTokens = (
  userId: string,
  role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN',
  sessionId?: string,
  jti?: string
): AuthTokens & { jti: string; sessionId: string } => {
  const env = getEnv();
  const tokenJti = jti || crypto.randomUUID();
  const tokenSessionId = sessionId || crypto.randomUUID();

  const accessPayload: JwtTokenPayload = {
    sub: userId,
    role,
    type: 'access',
  };

  const refreshPayload: JwtTokenPayload = {
    sub: userId,
    role,
    type: 'refresh',
    jti: tokenJti,
    sessionId: tokenSessionId,
  };

  const accessToken = jwt.sign(accessPayload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });

  const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });

  return {
    accessToken,
    refreshToken,
    jti: tokenJti,
    sessionId: tokenSessionId,
  };
};

export const verifyAccessToken = (token: string): JwtTokenPayload => {
  const env = getEnv();
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ['HS256'],
  });

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as any).sub !== 'string' ||
    !(decoded as any).sub ||
    !VALID_ROLES.has((decoded as any).role) ||
    (decoded as any).type !== 'access'
  ) {
    throw new jwt.JsonWebTokenError('Invalid access token payload');
  }

  return {
    sub: (decoded as any).sub,
    role: (decoded as any).role,
    type: 'access',
  };
};

export const verifyRefreshToken = (token: string): JwtTokenPayload => {
  const env = getEnv();
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ['HS256'],
  });

  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    typeof (decoded as any).sub !== 'string' ||
    !(decoded as any).sub ||
    !VALID_ROLES.has((decoded as any).role) ||
    (decoded as any).type !== 'refresh' ||
    typeof (decoded as any).jti !== 'string' ||
    !(decoded as any).jti ||
    typeof (decoded as any).sessionId !== 'string' ||
    !(decoded as any).sessionId
  ) {
    throw new jwt.JsonWebTokenError('Invalid refresh token payload');
  }

  return {
    sub: (decoded as any).sub,
    role: (decoded as any).role,
    type: 'refresh',
    jti: (decoded as any).jti,
    sessionId: (decoded as any).sessionId,
  };
};
