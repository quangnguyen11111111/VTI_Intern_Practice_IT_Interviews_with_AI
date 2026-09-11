import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'logging_access_secret_key_at_least_32_characters';
  process.env.JWT_REFRESH_SECRET = 'logging_refresh_secret_key_at_least_32_characters';
  process.env.PASSWORD_RESET_SECRET = 'logging_password_reset_secret_at_least_32_characters';
});
import { createApp } from '../src/app';
import { getEnv } from '../src/config/env';
import { createLogger } from '../src/infrastructure/logging/logger';
import { redact } from '../src/utils/redaction';

const allowedFields = new Set([
  'timestamp', 'level', 'event', 'requestId', 'route', 'method', 'status', 'durationMs',
  'actorIdHash', 'resourceType', 'resourceId', 'jobName', 'attempt',
]);

describe('AIP-53 structured logging and redaction', () => {
  it('recursively redacts nested secret and PII values without serializing Error objects', () => {
    const sentinel = 'SENTINEL_SECRET_NEVER_LOG';
    const value = {
      safe: 'kept',
      nested: {
        authorization: `Bearer ${sentinel}`,
        passwordHash: sentinel,
        profile: { email: 'sentinel.person@example.invalid', phone: '+84 912 345 678' },
        rawPrompt: sentinel,
        rawCvText: sentinel,
        candidateJdFile: sentinel,
        answers: [{ candidateAnswer: sentinel }],
        providerFailure: new Error(sentinel),
      },
    };
    const serialized = JSON.stringify(redact(value));
    expect(serialized).toContain('kept');
    expect(serialized).not.toContain(sentinel);
    expect(serialized).not.toContain('sentinel.person@example.invalid');
    expect(serialized).not.toContain('+84 912 345 678');
  });

  it('emits only allowlisted fields even when a provider failure object is supplied', () => {
    const lines: string[] = [];
    const output = createLogger(line => lines.push(line));
    output.error('ai.provider_failed', {
      attempt: 2,
      error: new Error('SENTINEL_PROVIDER_FAILURE'),
      providerResponse: { token: 'SENTINEL_PROVIDER_TOKEN', answer: 'SENTINEL_PROVIDER_ANSWER' },
    } as any);

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('SENTINEL');
    expect(Object.keys(JSON.parse(lines[0])).every(key => allowedFields.has(key))).toBe(true);
  });

  it('propagates the AIP-52 requestId across error and access logs without request headers or body', async () => {
    const lines: string[] = [];
    const output = createLogger(line => lines.push(line));
    const requestId = '5a873aa1-a006-4bc1-9fd4-ea7f99094ab5';
    const response = await request(createApp(getEnv(), output))
      .post('/api/v1/auth/login')
      .set('X-Request-Id', requestId)
      .set('Authorization', 'Bearer SENTINEL_AUTHORIZATION_VALUE')
      .set('Cookie', 'session=SENTINEL_COOKIE_VALUE')
      .send({ email: 'SENTINEL_EMAIL_VALUE', password: 'SENTINEL_PASSWORD_VALUE' })
      .expect(400);

    expect(response.body.requestId).toBe(requestId);
    const records = lines.map(line => JSON.parse(line));
    expect(records.map(record => record.event)).toEqual(expect.arrayContaining(['http.error.validation', 'http.access']));
    expect(records.every(record => record.requestId === requestId)).toBe(true);
    expect(lines.join('')).not.toContain('SENTINEL');
    expect(records.every(record => Object.keys(record).every(key => allowedFields.has(key)))).toBe(true);
  });
});
