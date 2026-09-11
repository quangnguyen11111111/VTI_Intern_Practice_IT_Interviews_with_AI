import { beforeEach, describe, expect, it } from 'vitest';
import { getEnv } from '../src/config/env';

const productionMongoUri = ['mongodb+srv://runtime_app', 'Q7mN4vL8rT2pX6cK@cluster.company.test/interviews'].join(':');

const validProductionEnv = {
  NODE_ENV: 'production',
  JWT_ACCESS_SECRET: 'production-access-secret-123456789012',
  JWT_REFRESH_SECRET: 'production-refresh-secret-12345678901',
  PASSWORD_RESET_SECRET: 'production-reset-secret-1234567890123',
  SMTP_HOST: 'smtp.company.example',
  SMTP_USER: 'mailer-user',
  SMTP_PASS: 'mailer-password',
  SMTP_FROM: 'mailer@company.example',
  CORS_ALLOWED_ORIGINS: 'https://app.company.example, https://admin.company.example',
  JSON_BODY_LIMIT: '256kb',
  FORM_BODY_LIMIT: '64kb',
  TRUST_PROXY_HOPS: '1',
  MONGODB_URI: productionMongoUri,
  GEMINI_API_KEY: 'runtime-gemini-key-for-environment-validation-2026',
};

describe('AIP-52 HTTP environment validation', () => {
  beforeEach(() => {
    for (const key of ['MONGODB_MIGRATION_URI', 'MONGO_MIGRATION_PASSWORD', 'DEPLOY_TOKEN',
      'DEPLOY_SSH_KEY', 'SERVER_SSH_KEY', 'SERVER_PASSWORD', 'GITHUB_TOKEN', 'GH_TOKEN',
      'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AZURE_CLIENT_SECRET', 'GOOGLE_APPLICATION_CREDENTIALS']) {
      delete process.env[key];
    }
    Object.assign(process.env, validProductionEnv);
  });

  it('normalizes origins and parses bounded HTTP configuration', () => {
    const env = getEnv();

    expect(env.CORS_ALLOWED_ORIGINS).toEqual([
      'https://app.company.example',
      'https://admin.company.example',
    ]);
    expect(env.JSON_BODY_LIMIT).toBe(256 * 1024);
    expect(env.FORM_BODY_LIMIT).toBe(64 * 1024);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
  });

  it('fails closed when a production CORS allowlist is empty', () => {
    process.env.CORS_ALLOWED_ORIGINS = '';

    expect(() => getEnv()).toThrow(/CORS_ALLOWED_ORIGINS must contain at least one origin/);
  });

  it('rejects wildcard, insecure, and loopback production origins', () => {
    for (const value of ['https://*.company.example', 'http://app.company.example', 'https://localhost:5173']) {
      process.env.CORS_ALLOWED_ORIGINS = value;
      expect(() => getEnv()).toThrow(/CORS_ALLOWED_ORIGINS/);
    }
  });

  it('rejects request limits and proxy counts outside their bounds', () => {
    process.env.CORS_ALLOWED_ORIGINS = validProductionEnv.CORS_ALLOWED_ORIGINS;
    process.env.JSON_BODY_LIMIT = '3mb';
    process.env.TRUST_PROXY_HOPS = '6';

    expect(() => getEnv()).toThrow(/JSON_BODY_LIMIT/);
    expect(() => getEnv()).toThrow(/TRUST_PROXY_HOPS/);
  });
  it('fails closed for missing, placeholder, or reused purpose-specific production secrets', () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => getEnv()).toThrow(/GEMINI_API_KEY/);

    Object.assign(process.env, validProductionEnv, { GEMINI_API_KEY: 'replace-with-gemini-api-key' });
    expect(() => getEnv()).toThrow(/non-placeholder production secret/);

    Object.assign(process.env, validProductionEnv, { SMTP_PASS: validProductionEnv.JWT_ACCESS_SECRET });
    expect(() => getEnv()).toThrow(/different for every purpose/);
  });

  it('rejects deploy and migration credentials in the production application process', () => {
    process.env.DEPLOY_SSH_KEY = 'should-remain-in-the-deploy-step';
    expect(() => getEnv()).toThrow(/deploy\/migration credentials/);
  });
});
