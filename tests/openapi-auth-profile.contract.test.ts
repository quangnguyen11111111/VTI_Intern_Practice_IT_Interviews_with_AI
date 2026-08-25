import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OpenAPI Auth & Profile Contract Tests', () => {
  const openApiFilePath = path.resolve(__dirname, '../docs/openapi-auth-profile.json');

  it('1. Parses valid OpenAPI 3.1.x JSON document', () => {
    expect(fs.existsSync(openApiFilePath)).toBe(true);
    const rawContent = fs.readFileSync(openApiFilePath, 'utf8');
    const doc = JSON.parse(rawContent);

    expect(doc).toBeDefined();
    expect(doc.openapi).toMatch(/^3\.1\.\d+$/);
    expect(doc.info).toBeDefined();
    expect(doc.info.title).toBeDefined();
    expect(doc.info.version).toBeDefined();
  });

  it('2. Contains all 11 required auth and profile routes and methods', () => {
    const doc = JSON.parse(fs.readFileSync(openApiFilePath, 'utf8'));

    const requiredEndpoints: Array<{ path: string; method: string }> = [
      { path: '/api/v1/auth/register', method: 'post' },
      { path: '/api/v1/auth/login', method: 'post' },
      { path: '/api/v1/auth/refresh', method: 'post' },
      { path: '/api/v1/auth/logout', method: 'post' },
      { path: '/api/v1/auth/users/{id}/lock', method: 'patch' },
      { path: '/api/v1/auth/lock/{id}', method: 'patch' },
      { path: '/api/v1/auth/password', method: 'patch' },
      { path: '/api/v1/auth/password/forgot', method: 'post' },
      { path: '/api/v1/auth/password/reset', method: 'post' },
      { path: '/api/v1/profile', method: 'get' },
      { path: '/api/v1/profile', method: 'patch' },
    ];

    for (const { path: routePath, method } of requiredEndpoints) {
      expect(doc.paths[routePath], `Missing route: ${routePath}`).toBeDefined();
      expect(doc.paths[routePath][method], `Missing method ${method} on ${routePath}`).toBeDefined();
      expect(doc.paths[routePath][method].operationId).toBeDefined();
      expect(doc.paths[routePath][method].responses).toBeDefined();
    }
  });

  it('3. Declares bearerAuth security scheme and applies it to protected endpoints', () => {
    const doc = JSON.parse(fs.readFileSync(openApiFilePath, 'utf8'));

    expect(doc.components).toBeDefined();
    expect(doc.components.securitySchemes).toBeDefined();
    expect(doc.components.securitySchemes.bearerAuth).toBeDefined();
    expect(doc.components.securitySchemes.bearerAuth.type).toBe('http');
    expect(doc.components.securitySchemes.bearerAuth.scheme).toBe('bearer');

    const protectedEndpoints = [
      { path: '/api/v1/auth/users/{id}/lock', method: 'patch' },
      { path: '/api/v1/auth/lock/{id}', method: 'patch' },
      { path: '/api/v1/auth/password', method: 'patch' },
      { path: '/api/v1/profile', method: 'get' },
      { path: '/api/v1/profile', method: 'patch' },
    ];

    for (const { path: routePath, method } of protectedEndpoints) {
      const op = doc.paths[routePath][method];
      expect(op.security, `Route ${routePath} should declare security`).toBeDefined();
      expect(op.security).toEqual(
        expect.arrayContaining([expect.objectContaining({ bearerAuth: [] })])
      );
    }

    const publicEndpoints = [
      { path: '/api/v1/auth/register', method: 'post' },
      { path: '/api/v1/auth/login', method: 'post' },
      { path: '/api/v1/auth/refresh', method: 'post' },
      { path: '/api/v1/auth/logout', method: 'post' },
      { path: '/api/v1/auth/password/forgot', method: 'post' },
      { path: '/api/v1/auth/password/reset', method: 'post' },
    ];

    for (const { path: routePath, method } of publicEndpoints) {
      const op = doc.paths[routePath][method];
      expect(op.security).toEqual([]);
    }
  });

  it('4. Documents expected response status codes for canonical and error envelopes', () => {
    const doc = JSON.parse(fs.readFileSync(openApiFilePath, 'utf8'));

    // Register
    expect(doc.paths['/api/v1/auth/register'].post.responses['201']).toBeDefined();
    expect(doc.paths['/api/v1/auth/register'].post.responses['400']).toBeDefined();
    expect(doc.paths['/api/v1/auth/register'].post.responses['409']).toBeDefined();

    // Login
    expect(doc.paths['/api/v1/auth/login'].post.responses['200']).toBeDefined();
    expect(doc.paths['/api/v1/auth/login'].post.responses['401']).toBeDefined();
    expect(doc.paths['/api/v1/auth/login'].post.responses['403']).toBeDefined();

    // Password forgot
    expect(doc.paths['/api/v1/auth/password/forgot'].post.responses['202']).toBeDefined();
    expect(doc.paths['/api/v1/auth/password/forgot'].post.responses['429']).toBeDefined();
    expect(doc.paths['/api/v1/auth/password/forgot'].post.responses['503']).toBeDefined();

    // Password reset
    expect(doc.paths['/api/v1/auth/password/reset'].post.responses['200']).toBeDefined();
    expect(doc.paths['/api/v1/auth/password/reset'].post.responses['400']).toBeDefined();

    // Password change
    expect(doc.paths['/api/v1/auth/password'].patch.responses['200']).toBeDefined();
    expect(doc.paths['/api/v1/auth/password'].patch.responses['400']).toBeDefined();
    expect(doc.paths['/api/v1/auth/password'].patch.responses['409']).toBeDefined();

    // Lock routes
    expect(doc.paths['/api/v1/auth/users/{id}/lock'].patch.responses['200']).toBeDefined();
    expect(doc.paths['/api/v1/auth/users/{id}/lock'].patch.responses['404']).toBeDefined();
    expect(doc.paths['/api/v1/auth/lock/{id}'].patch.responses['200']).toBeDefined();
    expect(doc.paths['/api/v1/auth/lock/{id}'].patch.responses['404']).toBeDefined();

    // Profile routes
    expect(doc.paths['/api/v1/profile'].get.responses['200']).toBeDefined();
    expect(doc.paths['/api/v1/profile'].patch.responses['200']).toBeDefined();
  });

  it('5. Contains all required schemas without exposing internal or sensitive fields', () => {
    const doc = JSON.parse(fs.readFileSync(openApiFilePath, 'utf8'));

    const requiredSchemas = [
      'SafeUser',
      'AuthTokens',
      'AuthResponseData',
      'AuthResponse',
      'GenericSuccessResponse',
      'ProfileResponse',
      'LockUserResponse',
      'ErrorResponse',
      'ValidationErrorDetail',
      'RegisterInput',
      'LoginInput',
      'RefreshTokenInput',
      'LogoutInput',
      'ChangePasswordInput',
      'ForgotPasswordInput',
      'ResetPasswordInput',
      'UpdateProfileInput',
    ];

    for (const schemaName of requiredSchemas) {
      expect(doc.components.schemas[schemaName], `Missing schema: ${schemaName}`).toBeDefined();
    }

    // Verify SafeUser strictly omits internal fields
    const safeUserProps = Object.keys(doc.components.schemas.SafeUser.properties);
    expect(safeUserProps).not.toContain('password');
    expect(safeUserProps).not.toContain('passwordHash');
    expect(safeUserProps).not.toContain('authVersion');
    expect(safeUserProps).not.toContain('credentialVersion');

    // Verify strict schemas have additionalProperties: false
    expect(doc.components.schemas.SafeUser.additionalProperties).toBe(false);
    expect(doc.components.schemas.RegisterInput.additionalProperties).toBe(false);
    expect(doc.components.schemas.LoginInput.additionalProperties).toBe(false);
    expect(doc.components.schemas.ChangePasswordInput.additionalProperties).toBe(false);
    expect(doc.components.schemas.ForgotPasswordInput.additionalProperties).toBe(false);
    expect(doc.components.schemas.ResetPasswordInput.additionalProperties).toBe(false);
    expect(doc.components.schemas.UpdateProfileInput.additionalProperties).toBe(false);
  });
});
