import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'http-security-access-secret-1234567890';
  process.env.JWT_REFRESH_SECRET = 'http-security-refresh-secret-123456789';
  process.env.PASSWORD_RESET_SECRET = 'http-security-password-reset-secret-12345';
  process.env.CORS_ALLOWED_ORIGINS = 'https://allowed.example';
});

import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { globalErrorHandler } from '../src/middlewares/error.middleware';
import { requestContext } from '../src/middlewares/request-context.middleware';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('AIP-52 HTTP security controls', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ALLOWED_ORIGINS = 'https://allowed.example';
  });

  it('adds a correlation ID and the expected security headers', async () => {
    const response = await request(createApp(getEnv())).get('/health').expect(200);

    expect(response.headers['x-request-id']).toMatch(uuidPattern);
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('echoes a valid incoming correlation ID and replaces an invalid one', async () => {
    const app = createApp(getEnv());
    const suppliedId = '3d6f0a9d-00b5-4c6c-8c31-8dfc76482c59';

    const accepted = await request(app).get('/health').set('X-Request-Id', suppliedId).expect(200);
    const replaced = await request(app).get('/health').set('X-Request-Id', 'not-a-uuid').expect(200);

    expect(accepted.headers['x-request-id']).toBe(suppliedId);
    expect(replaced.headers['x-request-id']).toMatch(uuidPattern);
    expect(replaced.headers['x-request-id']).not.toBe('not-a-uuid');
  });

  it('allows configured browser origins and rejects all other origins', async () => {
    const app = createApp(getEnv());

    const allowed = await request(app).get('/health').set('Origin', 'https://allowed.example').expect(200);
    const denied = await request(app).get('/health').set('Origin', 'https://denied.example').expect(403);

    expect(allowed.headers['access-control-allow-origin']).toBe('https://allowed.example');
    expect(denied.body).toMatchObject({
      success: false,
      code: 'CORS_ORIGIN_DENIED',
    });
    expect(denied.body.requestId).toMatch(uuidPattern);
  });

  it('rejects denied CORS preflight requests', async () => {
    const response = await request(createApp(getEnv()))
      .options('/api/v1/auth/login')
      .set('Origin', 'https://denied.example')
      .set('Access-Control-Request-Method', 'POST')
      .expect(403);

    expect(response.body.code).toBe('CORS_ORIGIN_DENIED');
  });

  it('returns structured errors for malformed JSON and unsupported media types', async () => {
    const app = createApp(getEnv());

    const malformed = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    const unsupported = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'text/plain')
      .send('email=user@example.com')
      .expect(415);

    expect(malformed.body).toMatchObject({ success: false, code: 'INVALID_JSON' });
    expect(malformed.body.requestId).toMatch(uuidPattern);
    expect(unsupported.body).toMatchObject({ success: false, code: 'UNSUPPORTED_MEDIA_TYPE' });
    expect(unsupported.body.requestId).toMatch(uuidPattern);
  });

  it('rejects JSON bodies above the configured limit', async () => {
    const env = { ...getEnv(), JSON_BODY_LIMIT: 1024 };
    const response = await request(createApp(env))
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'x'.repeat(2000) })
      .expect(413);

    expect(response.body).toMatchObject({ success: false, code: 'PAYLOAD_TOO_LARGE' });
    expect(response.body.requestId).toMatch(uuidPattern);
  });

  it('rejects unsupported upload types and files above 5MB', async () => {
    const app = createApp(getEnv());
    const unsupported = await request(app)
      .post('/api/v1/interviews/generate-from-jd')
      .attach('jdFile', Buffer.from('plain text'), {
        filename: 'job-description.txt',
        contentType: 'text/plain',
      })
      .expect(415);
    const oversized = await request(app)
      .post('/api/v1/interviews/generate-from-jd')
      .attach('jdFile', Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: 'job-description.pdf',
        contentType: 'application/pdf',
      })
      .expect(413);

    expect(unsupported.body).toMatchObject({ success: false, code: 'UNSUPPORTED_FILE_TYPE' });
    expect(oversized.body).toMatchObject({ success: false, code: 'UPLOAD_TOO_LARGE' });
  });

  it('validates params, query, and body before controllers run', async () => {
    const app = createApp(getEnv());

    const params = await request(app).get('/api/v1/interviews/not-an-object-id').expect(400);
    const query = await request(app).get('/api/v1/roles?limit=0&unexpected=true').expect(400);
    const body = await request(app)
      .post('/api/v1/interviews')
      .send({ jobPosition: 'bad', level: 'bad', techStacks: [], unexpected: true })
      .expect(400);

    for (const response of [params, query, body]) {
      expect(response.body).toMatchObject({ success: false, code: 'VALIDATION_ERROR' });
      expect(response.body.requestId).toMatch(uuidPattern);
      expect(response.body.errors.length).toBeGreaterThan(0);
    }
  });

  it('enables HSTS and hides unexpected error details in production', async () => {
    const productionApp = createApp({
      ...getEnv(),
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: ['https://app.example.com'],
    });
    const health = await request(productionApp).get('/health').expect(200);
    expect(health.headers['strict-transport-security']).toContain('max-age=');

    const errorApp = express();
    errorApp.set('env', 'production');
    errorApp.use(requestContext);
    errorApp.get('/boom', () => {
      throw new Error('database password leaked');
    });
    errorApp.use(globalErrorHandler);

    const response = await request(errorApp).get('/boom').expect(500);
    expect(response.body).toMatchObject({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Lỗi hệ thống ngoại lệ',
    });
    expect(response.body.requestId).toMatch(uuidPattern);
    expect(response.body.stack).toBeUndefined();
    expect(JSON.stringify(response.body)).not.toContain('database password leaked');
  });
});
