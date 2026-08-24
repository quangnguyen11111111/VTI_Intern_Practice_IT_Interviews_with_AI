import { defineConfig } from 'vitest/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: join(tmpdir(), 'vti-ai-interview-backend-coverage'),
      include: [
        'src/controllers/auth.controller.ts',
        'src/controllers/profile.controller.ts',
        'src/middlewares/auth.middleware.ts',
        'src/middlewares/ownership.middleware.ts',
        'src/middlewares/validate.middleware.ts',
        'src/models/user.model.ts',
        'src/models/refresh-token.model.ts',
        'src/models/password-reset-otp.model.ts',
        'src/models/password-reset-rate-limit.model.ts',
        'src/services/auth.service.ts',
        'src/services/email.service.ts',
        'src/services/profile.service.ts',
        'src/utils/token.ts',
        'src/validators/auth.validator.ts',
        'src/validators/profile.validator.ts',
      ],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
});
