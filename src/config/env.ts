import { z } from 'zod';

const placeholderSecrets = new Set([
  'replace-with-at-least-32-random-characters',
  'replace-with-another-at-least-32-random-characters',
  'replace-with-password-reset-secret-at-least-32-chars',
]);

const placeholderSmtpValues = new Set([
  'smtp.example.com',
  'replace-with-smtp-user',
  'replace-with-smtp-password',
  'no-reply@example.com',
]);

const expiresInRegex = /^(\d+)(ms|s|m|h|d|w|y)?$/i;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z
      .string()
      .optional()
      .default('3000')
      .transform((val) => {
        const port = parseInt(val, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error('PORT must be a valid port number between 1 and 65535');
        }
        return port;
      }),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .default('mongodb://127.0.0.1:27017/ai_interview_practice'),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long'),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
    JWT_ACCESS_EXPIRES_IN: z
      .string()
      .regex(expiresInRegex, 'JWT_ACCESS_EXPIRES_IN must be a valid duration (e.g. 15m, 1h, 7d)')
      .default('15m'),
    JWT_REFRESH_EXPIRES_IN: z
      .string()
      .regex(expiresInRegex, 'JWT_REFRESH_EXPIRES_IN must be a valid duration (e.g. 7d, 30d, 1y)')
      .default('7d'),
    BCRYPT_SALT_ROUNDS: z
      .string()
      .optional()
      .default('12')
      .transform((val) => {
        const rounds = parseInt(val, 10);
        if (isNaN(rounds) || rounds < 10 || rounds > 14) {
          throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 10 and 14');
        }
        return rounds;
      }),
    PASSWORD_RESET_SECRET: z
      .string()
      .min(32, 'PASSWORD_RESET_SECRET must be at least 32 characters long')
      .default('default_password_reset_secret_key_at_least_32_characters_long_12345'),
    SMTP_HOST: z.string().trim().min(1, 'SMTP_HOST cannot be empty').optional().default('localhost'),
    SMTP_PORT: z
      .string()
      .optional()
      .default('587')
      .transform((val) => {
        const port = parseInt(val, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          throw new Error('SMTP_PORT must be a valid port number between 1 and 65535');
        }
        return port;
      }),
    SMTP_SECURE: z
      .enum(['true', 'false', '1', '0'])
      .optional()
      .default('false')
      .transform((val) => val === 'true' || val === '1'),
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASS: z.string().optional().default(''),
    SMTP_FROM: z.string().trim().min(1, 'SMTP_FROM cannot be empty').optional().default('no-reply@vti.com.vn'),
  })
  .superRefine((data, ctx) => {
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
        path: ['JWT_REFRESH_SECRET'],
      });
    }

    if (data.PASSWORD_RESET_SECRET === data.JWT_ACCESS_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASSWORD_RESET_SECRET and JWT_ACCESS_SECRET must be different',
        path: ['PASSWORD_RESET_SECRET'],
      });
    }

    if (data.PASSWORD_RESET_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PASSWORD_RESET_SECRET and JWT_REFRESH_SECRET must be different',
        path: ['PASSWORD_RESET_SECRET'],
      });
    }

    if (data.NODE_ENV === 'production') {
      if (placeholderSecrets.has(data.JWT_ACCESS_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_ACCESS_SECRET cannot use default placeholder in production',
          path: ['JWT_ACCESS_SECRET'],
        });
      }
      if (placeholderSecrets.has(data.JWT_REFRESH_SECRET)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'JWT_REFRESH_SECRET cannot use default placeholder in production',
          path: ['JWT_REFRESH_SECRET'],
        });
      }
      if (
        placeholderSecrets.has(data.PASSWORD_RESET_SECRET) ||
        data.PASSWORD_RESET_SECRET === 'default_password_reset_secret_key_at_least_32_characters_long_12345'
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'PASSWORD_RESET_SECRET cannot use default placeholder in production',
          path: ['PASSWORD_RESET_SECRET'],
        });
      }
      if (!data.SMTP_HOST || data.SMTP_HOST === 'localhost') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_HOST is required in production',
          path: ['SMTP_HOST'],
        });
      }
      if (!data.SMTP_USER) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_USER is required in production',
          path: ['SMTP_USER'],
        });
      }
      if (!data.SMTP_PASS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_PASS is required in production',
          path: ['SMTP_PASS'],
        });
      }
      if (!data.SMTP_FROM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_FROM is required in production',
          path: ['SMTP_FROM'],
        });
      }
      if (placeholderSmtpValues.has(data.SMTP_HOST)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_HOST cannot use an example placeholder in production',
          path: ['SMTP_HOST'],
        });
      }
      if (placeholderSmtpValues.has(data.SMTP_USER)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_USER cannot use an example placeholder in production',
          path: ['SMTP_USER'],
        });
      }
      if (placeholderSmtpValues.has(data.SMTP_PASS)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_PASS cannot use an example placeholder in production',
          path: ['SMTP_PASS'],
        });
      }
      if (placeholderSmtpValues.has(data.SMTP_FROM)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'SMTP_FROM cannot use an example placeholder in production',
          path: ['SMTP_FROM'],
        });
      }
    }
  });

export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  MONGODB_URI: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  BCRYPT_SALT_ROUNDS: number;
  PASSWORD_RESET_SECRET: string;
  SMTP_HOST: string;
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  SMTP_FROM: string;
}

export const getEnv = (): AppEnv => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorMessages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Environment validation failed: ${errorMessages}`);
  }
  return result.data as AppEnv;
};
