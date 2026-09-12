import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'test_jwt_access_secret_key_at_least_32_characters_long_12345';
  process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_at_least_32_characters_long_67890';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.BCRYPT_SALT_ROUNDS = '10';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
});

import {
  verifyGoogleIdToken,
  _clearGoogleJwksCache,
} from '../src/services/google-identity.service';
import { AppError } from '../src/utils/AppError';

describe('Google Identity Service Unit Tests', () => {
  const TEST_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

  const rsaPair1 = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid1 = 'test-kid-1';
  const jwk1 = {
    ...rsaPair1.publicKey.export({ format: 'jwk' }),
    kid: kid1,
    alg: 'RS256',
    use: 'sig',
  };

  const rsaPair2 = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid2 = 'test-kid-2';
  const jwk2 = {
    ...rsaPair2.publicKey.export({ format: 'jwk' }),
    kid: kid2,
    alg: 'RS256',
    use: 'sig',
  };

  const privateKeyPem1 = rsaPair1.privateKey.export({ format: 'pem', type: 'pkcs8' });
  const privateKeyPem2 = rsaPair2.privateKey.export({ format: 'pem', type: 'pkcs8' });

  const signToken = (
    claims: Record<string, any>,
    privateKey = privateKeyPem1,
    keyid: string | null = kid1,
    options?: jwt.SignOptions
  ): string => {
    return jwt.sign(claims, privateKey, {
      algorithm: 'RS256',
      ...(keyid ? { keyid } : {}),
      ...options,
    });
  };

  const validClaims = {
    iss: 'https://accounts.google.com',
    aud: TEST_CLIENT_ID,
    sub: '123456789012345678901',
    email: 'user@example.com',
    email_verified: true,
    name: 'Test User',
    picture: 'https://lh3.googleusercontent.com/a/photo.jpg',
    exp: Math.floor(Date.now() / 1000) + 300,
  };

  let mockKeys: Array<Record<string, any>>;

  beforeEach(() => {
    vi.restoreAllMocks();
    _clearGoogleJwksCache();
    process.env.GOOGLE_CLIENT_ID = TEST_CLIENT_ID;
    mockKeys = [jwk1];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('googleapis.com')) {
        return new Response(JSON.stringify({ keys: mockKeys }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
      return new Response('Not found', { status: 404 });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    _clearGoogleJwksCache();
  });

  it('1. Successfully verifies valid token with full claims', async () => {
    const token = signToken(validClaims);
    const result = await verifyGoogleIdToken(token);

    expect(result).toEqual({
      sub: '123456789012345678901',
      email: 'user@example.com',
      emailVerified: true,
      name: 'Test User',
      picture: 'https://lh3.googleusercontent.com/a/photo.jpg',
      hd: undefined,
    });
  });

  it('2. Successfully verifies token with accounts.google.com issuer (without https scheme)', async () => {
    const token = signToken({
      ...validClaims,
      iss: 'accounts.google.com',
    });
    const result = await verifyGoogleIdToken(token);
    expect(result.sub).toBe(validClaims.sub);
  });

  it('3. Successfully verifies token with optional hd claim and minimal claims', async () => {
    const token = signToken({
      iss: 'https://accounts.google.com',
      aud: TEST_CLIENT_ID,
      sub: '987654321',
      email: 'corp@vti.com.vn',
      email_verified: true,
      hd: 'vti.com.vn',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    const result = await verifyGoogleIdToken(token);
    expect(result).toEqual({
      sub: '987654321',
      email: 'corp@vti.com.vn',
      emailVerified: true,
      name: undefined,
      picture: null,
      hd: 'vti.com.vn',
    });
  });

  it('4. Rejects token with invalid signature', async () => {
    // Signed with privateKey2, but header claims kid1 (which points to pubKey1)
    const token = signToken(validClaims, privateKeyPem2, kid1);

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('5. Rejects token with wrong audience', async () => {
    const token = signToken({
      ...validClaims,
      aud: 'wrong-client-id.apps.googleusercontent.com',
    });

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('6. Rejects token with wrong issuer', async () => {
    const token = signToken({
      ...validClaims,
      iss: 'https://attacker.example.com',
    });

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('7. Rejects expired token', async () => {
    const token = signToken(
      {
        ...validClaims,
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      privateKeyPem1,
      kid1,
      { noTimestamp: true }
    );

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('8. Rejects token with email_verified: false', async () => {
    const token = signToken({
      ...validClaims,
      email_verified: false,
    });

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('9. Rejects malformed verification claims instead of coercing their types', async () => {
    const stringVerifiedToken = signToken({
      ...validClaims,
      email_verified: 'true',
    });
    await expect(verifyGoogleIdToken(stringVerifiedToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });

    const arrayAudienceToken = signToken({
      ...validClaims,
      aud: [TEST_CLIENT_ID, 'another-client-id.apps.googleusercontent.com'],
    });
    await expect(verifyGoogleIdToken(arrayAudienceToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });

    const missingExpiryToken = signToken(
      Object.fromEntries(Object.entries(validClaims).filter(([key]) => key !== 'exp'))
    );
    await expect(verifyGoogleIdToken(missingExpiryToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('10. Rejects malformed claims: missing sub', async () => {
    const token = signToken({
      ...validClaims,
      sub: '',
    });

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('11. Rejects malformed claims: invalid email format', async () => {
    const token = signToken({
      ...validClaims,
      email: 'not-an-email',
    });

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('12. Rejects malformed claims: non-https avatar URL', async () => {
    const token = signToken({
      ...validClaims,
      picture: 'http://insecure.example.com/avatar.jpg',
    });

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('13. Rejects token with non-RS256 algorithm or missing kid', async () => {
    // Non-RS256
    const noneToken = jwt.sign(validClaims, 'secret', { algorithm: 'HS256', keyid: kid1 });
    await expect(verifyGoogleIdToken(noneToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });

    // Missing kid
    const noKidToken = signToken(validClaims, privateKeyPem1, null);
    await expect(verifyGoogleIdToken(noKidToken)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
  });

  it('14. Reuses cached JWKS and does not refetch on subsequent calls', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const token = signToken(validClaims);

    await verifyGoogleIdToken(token);
    await verifyGoogleIdToken(token);
    await verifyGoogleIdToken(token);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('15. Deduplicates concurrent in-flight JWKS fetches', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const token = signToken(validClaims);

    await Promise.all([
      verifyGoogleIdToken(token),
      verifyGoogleIdToken(token),
      verifyGoogleIdToken(token),
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('16. Key rotation: force refreshes at most once when kid is unknown', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    // First call caches only kid1
    const token1 = signToken(validClaims);
    await verifyGoogleIdToken(token1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Update remote certs to include kid2
    mockKeys = [jwk1, jwk2];

    // Second call with kid2 triggers force-refresh exactly once
    const token2 = signToken(validClaims, privateKeyPem2, kid2);
    const res2 = await verifyGoogleIdToken(token2);
    expect(res2.sub).toBe(validClaims.sub);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // Third call with unknown kid3 triggers force-refresh once and rejects
    const tokenUnknown = signToken(validClaims, privateKeyPem2, 'unknown-kid-3');
    await expect(verifyGoogleIdToken(tokenUnknown)).rejects.toMatchObject({
      statusCode: 401,
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('17. Fails closed with 503 AUTH_GOOGLE_NOT_CONFIGURED when GOOGLE_CLIENT_ID is missing', async () => {
    process.env.GOOGLE_CLIENT_ID = '';
    const token = signToken(validClaims);

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 503,
      code: 'AUTH_GOOGLE_NOT_CONFIGURED',
    });
  });

  it('18. Returns 503 AUTH_GOOGLE_UNAVAILABLE when JWKS endpoint is down or returns error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const token = signToken(validClaims);

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 503,
      code: 'AUTH_GOOGLE_UNAVAILABLE',
    });
  });

  it('19. Returns 503 AUTH_GOOGLE_UNAVAILABLE when JWKS returns non-200 status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Server Error', { status: 500 }));
    const token = signToken(validClaims);

    await expect(verifyGoogleIdToken(token)).rejects.toMatchObject({
      statusCode: 503,
      code: 'AUTH_GOOGLE_UNAVAILABLE',
    });
  });
});
