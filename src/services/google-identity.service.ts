import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env';
import { AppError } from '../utils/AppError';

export interface GoogleVerifiedIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string | null;
  hd?: string;
}

interface JwksCache {
  keys: Map<string, string>;
  expiresAt: number;
}

let jwksCache: JwksCache | null = null;
let inFlightJwksPromise: Promise<Map<string, string>> | null = null;

export const _clearGoogleJwksCache = (): void => {
  jwksCache = null;
  inFlightJwksPromise = null;
};

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_CACHE_TTL_MS = 3600 * 1000;
const MIN_CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_TTL_MS = 86400 * 1000;

const fetchGoogleJwks = async (): Promise<{ keys: Map<string, string>; ttlMs: number }> => {
  let response: Response;
  try {
    response = await fetch(GOOGLE_CERTS_URL, {
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch {
    throw new AppError('Dịch vụ xác thực Google tạm thời không khả dụng', 503, 'AUTH_GOOGLE_UNAVAILABLE');
  }

  if (!response.ok) {
    throw new AppError('Dịch vụ xác thực Google tạm thời không khả dụng', 503, 'AUTH_GOOGLE_UNAVAILABLE');
  }

  let body: any;
  try {
    body = await response.json();
  } catch {
    throw new AppError('Dịch vụ xác thực Google tạm thời không khả dụng', 503, 'AUTH_GOOGLE_UNAVAILABLE');
  }

  if (!body || !Array.isArray(body.keys)) {
    throw new AppError('Dịch vụ xác thực Google tạm thời không khả dụng', 503, 'AUTH_GOOGLE_UNAVAILABLE');
  }

  const keyMap = new Map<string, string>();
  for (const jwk of body.keys) {
    if (
      jwk &&
      jwk.kty === 'RSA' &&
      typeof jwk.kid === 'string' &&
      jwk.kid.trim() &&
      (!jwk.alg || jwk.alg === 'RS256')
    ) {
      try {
        const keyObj = crypto.createPublicKey({ key: jwk, format: 'jwk' });
        const pem = keyObj.export({ format: 'pem', type: 'spki' }) as string;
        keyMap.set(jwk.kid, pem);
      } catch {
        // Bỏ qua key lỗi định dạng
      }
    }
  }

  if (keyMap.size === 0) {
    throw new AppError('Dịch vụ xác thực Google tạm thời không khả dụng', 503, 'AUTH_GOOGLE_UNAVAILABLE');
  }

  let ttlMs = DEFAULT_CACHE_TTL_MS;
  const cacheControl = response.headers?.get?.('cache-control');
  if (cacheControl) {
    const match = /max-age=(\d+)/i.exec(cacheControl);
    if (match) {
      const parsedSec = parseInt(match[1], 10);
      if (!isNaN(parsedSec)) {
        ttlMs = Math.min(Math.max(parsedSec * 1000, MIN_CACHE_TTL_MS), MAX_CACHE_TTL_MS);
      }
    }
  }

  return { keys: keyMap, ttlMs };
};

const getGooglePublicKeyMap = async (forceRefresh = false): Promise<Map<string, string>> => {
  const now = Date.now();
  if (!forceRefresh && jwksCache && jwksCache.expiresAt > now && jwksCache.keys.size > 0) {
    return jwksCache.keys;
  }

  if (inFlightJwksPromise) {
    return inFlightJwksPromise;
  }

  inFlightJwksPromise = (async () => {
    try {
      const { keys, ttlMs } = await fetchGoogleJwks();
      jwksCache = {
        keys,
        expiresAt: Date.now() + ttlMs,
      };
      return keys;
    } finally {
      inFlightJwksPromise = null;
    }
  })();

  return inFlightJwksPromise;
};

export const verifyGoogleIdToken = async (idToken: string): Promise<GoogleVerifiedIdentity> => {
  const env = getEnv();
  const configuredClientId = env.GOOGLE_CLIENT_ID?.trim();
  if (!configuredClientId) {
    throw new AppError('Google authentication chưa được cấu hình', 503, 'AUTH_GOOGLE_NOT_CONFIGURED');
  }

  if (typeof idToken !== 'string' || !idToken.trim() || idToken.length > 8192) {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  const trimmedToken = idToken.trim();

  let decoded: any;
  try {
    decoded = jwt.decode(trimmedToken, { complete: true });
  } catch {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  if (!decoded || !decoded.header || typeof decoded.header !== 'object') {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  const { alg, kid } = decoded.header;
  if (alg !== 'RS256' || typeof kid !== 'string' || !kid.trim()) {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  let keyMap = await getGooglePublicKeyMap(false);
  let pem = keyMap.get(kid);

  if (!pem) {
    // Key rotation: force refresh tối đa một lần
    keyMap = await getGooglePublicKeyMap(true);
    pem = keyMap.get(kid);
    if (!pem) {
      throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
    }
  }

  let payload: any;
  try {
    payload = jwt.verify(trimmedToken, pem, {
      algorithms: ['RS256'],
      audience: configuredClientId,
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
    });
  } catch {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  if (!payload || typeof payload !== 'object') {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  if (typeof payload.aud !== 'string' || payload.aud !== configuredClientId) {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  // Issuer verification: accounts.google.com hoặc https://accounts.google.com
  if (payload.iss !== 'accounts.google.com' && payload.iss !== 'https://accounts.google.com') {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  // email_verified bắt buộc là true
  if (payload.email_verified !== true) {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  // Provider identifier: sub
  if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 255) {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  // Email claim validation
  if (
    typeof payload.email !== 'string' ||
    !payload.email.trim() ||
    payload.email.length > 255 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email.trim())
  ) {
    throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
  }

  // Full name claim (optional)
  let name: string | undefined = undefined;
  if (payload.name !== undefined && payload.name !== null) {
    if (typeof payload.name !== 'string' || payload.name.length > 255) {
      throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
    }
    name = payload.name.trim();
  }

  // Avatar validation: chỉ chấp nhận HTTPS hợp lệ
  let picture: string | null = null;
  if (payload.picture !== undefined && payload.picture !== null) {
    if (typeof payload.picture !== 'string' || payload.picture.length > 2048) {
      throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
    }
    try {
      const parsedUrl = new URL(payload.picture);
      if (parsedUrl.protocol !== 'https:') {
        throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
      }
      picture = payload.picture.trim();
    } catch {
      throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
    }
  }

  // Hosted domain claim (optional hd)
  let hd: string | undefined = undefined;
  if (payload.hd !== undefined && payload.hd !== null) {
    if (typeof payload.hd !== 'string' || !payload.hd.trim() || payload.hd.length > 255) {
      throw new AppError('Google credential không hợp lệ', 401, 'AUTH_INVALID_GOOGLE_CREDENTIAL');
    }
    hd = payload.hd.trim();
  }

  return {
    sub: payload.sub.trim(),
    email: payload.email.trim().toLowerCase(),
    emailVerified: true,
    name,
    picture,
    hd,
  };
};
