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
        'src/controllers/InterviewController.ts',
        'src/controllers/level.controller.ts',
        'src/controllers/profile.controller.ts',
        'src/controllers/role.controller.ts',
        'src/controllers/technology.controller.ts',
        'src/domain/interview/**/*.ts',
        'src/middlewares/auth.middleware.ts',
        'src/middlewares/ownership.middleware.ts',
        'src/middlewares/validate.middleware.ts',
        'src/models/InterviewSession.ts',
        'src/models/level.model.ts',
        'src/models/role.model.ts',
        'src/models/technology.model.ts',
        'src/models/user.model.ts',
        'src/models/refresh-token.model.ts',
        'src/models/password-reset-otp.model.ts',
        'src/models/password-reset-rate-limit.model.ts',
        'src/repositories/MongoInterviewRepository.ts',
        'src/repositories/base.repository.ts',
        'src/repositories/level.repository.ts',
        'src/repositories/role.repository.ts',
        'src/repositories/technology.repository.ts',
        'src/services/auth.service.ts',
        'src/services/email.service.ts',
        'src/services/InterviewService.ts',
        'src/services/level.service.ts',
        'src/services/profile.service.ts',
        'src/services/role.service.ts',
        'src/services/technology.service.ts',
        'src/utils/token.ts',
        'src/validators/auth.validator.ts',
        'src/validators/common.validator.ts',
        'src/validators/interview.validator.ts',
        'src/validators/profile.validator.ts',
        'src/validators/taxonomy.validator.ts',
      ],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
        'src/services/auth.service.ts': {
          branches: 85,
        },
        'src/middlewares/auth.middleware.ts': {
          branches: 85,
        },
        'src/middlewares/ownership.middleware.ts': {
          branches: 85,
        },
        'src/validators/**/*.ts': {
          branches: 85,
        },
      },
    },
  },
});
