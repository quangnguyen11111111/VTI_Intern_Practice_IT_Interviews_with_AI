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
  jti?: string,
  credentialVersion: number = 0
): AuthTokens & { jti: string; sessionId: string; credentialVersion: number } => {
  const env = getEnv();
  const tokenJti = jti || crypto.randomUUID();
  const tokenSessionId = sessionId || crypto.randomUUID();

  if (!Number.isInteger(credentialVersion) || credentialVersion < 0) {
    throw new Error('credentialVersion must be a non-negative integer');
  }

  const accessPayload: JwtTokenPayload = {
    sub: userId,
    role,
    type: 'access',
    credentialVersion,
  };

  const refreshPayload: JwtTokenPayload = {
    sub: userId,
    role,
    type: 'refresh',
    credentialVersion,
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
    credentialVersion,
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
    (decoded as any).type !== 'access' ||
    typeof (decoded as any).credentialVersion !== 'number' ||
    !Number.isInteger((decoded as any).credentialVersion) ||
    (decoded as any).credentialVersion < 0
  ) {
    throw new jwt.JsonWebTokenError('Invalid access token payload');
  }

  return {
    sub: (decoded as any).sub,
    role: (decoded as any).role,
    type: 'access',
    credentialVersion: (decoded as any).credentialVersion,
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
    !(decoded as any).sessionId ||
    typeof (decoded as any).credentialVersion !== 'number' ||
    !Number.isInteger((decoded as any).credentialVersion) ||
    (decoded as any).credentialVersion < 0
  ) {
    throw new jwt.JsonWebTokenError('Invalid refresh token payload');
  }

  return {
    sub: (decoded as any).sub,
    role: (decoded as any).role,
    type: 'refresh',
    jti: (decoded as any).jti,
    sessionId: (decoded as any).sessionId,
    credentialVersion: (decoded as any).credentialVersion,
  };
};
