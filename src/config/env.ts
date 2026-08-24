import { z } from 'zod';

const placeholderSecrets = new Set([
  'replace-with-at-least-32-random-characters',
  'replace-with-another-at-least-32-random-characters',
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
  })
  .superRefine((data, ctx) => {
    if (data.JWT_ACCESS_SECRET === data.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different',
        path: ['JWT_REFRESH_SECRET'],
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
}

export const getEnv = (): AppEnv => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const errorMessages = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Environment validation failed: ${errorMessages}`);
  }
  return result.data as AppEnv;
};
