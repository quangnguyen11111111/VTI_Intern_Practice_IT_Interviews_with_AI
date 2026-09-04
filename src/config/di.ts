import { container } from 'tsyringe';
import { AgendaJobScheduler } from '../infrastructure/jobs/AgendaJobScheduler';
import { GenerateQuestionJobHandler } from '../domain/jobs/handlers/GenerateQuestionJobHandler';

import { InterviewEventBus } from '../infrastructure/events/InterviewEventBus';

// Repositories
import { RoleRepository } from '../repositories/role.repository';
import { LevelRepository } from '../repositories/level.repository';
import { TechnologyRepository } from '../repositories/technology.repository';
import { MongoInterviewRepository } from '../repositories/MongoInterviewRepository';
import { UserRepository } from '../repositories/user.repository';
import { AuditRepository } from '../repositories/audit.repository';

// Services
import { RoleService } from '../services/role.service';
import { LevelService } from '../services/level.service';
import { TechnologyService } from '../services/technology.service';
import { InterviewService } from '../services/InterviewService';

// AI Providers
import { MockAiProvider } from '../services/ai/providers/MockAiProvider';
import { GeminiAiProvider } from '../services/ai/providers/GeminiAiProvider';
import { AdminUserService } from '../services/admin-user.service';
import { AuditService } from '../services/audit.service';
import { EvaluateAnswersJobHandler } from '../domain/jobs/handlers/EvaluateAnswersJobHandler';

// Register Repositories
container.register('IRoleRepository', { useClass: RoleRepository });
container.register('ILevelRepository', { useClass: LevelRepository });
container.register('ITechnologyRepository', { useClass: TechnologyRepository });
container.register('IInterviewRepository', { useClass: MongoInterviewRepository });

// Register AI Provider based on .env
if (process.env.NODE_ENV === 'test') {
  container.register('IAiProvider', { useClass: MockAiProvider });
} else {

  container.register('IAiProvider', { useClass: GeminiAiProvider });
}

// Background Jobs
container.registerSingleton('IJobScheduler', AgendaJobScheduler);
container.registerSingleton(GenerateQuestionJobHandler);
container.registerSingleton(EvaluateAnswersJobHandler);

// Event Bus
container.registerSingleton('IEventPublisher', InterviewEventBus);


container.register('IUserRepository', {
  useClass: UserRepository
});

container.register('IAuditRepository', {
  useClass: AuditRepository
});

// Register Services
container.register('IRoleService', { useClass: RoleService });
container.register('ILevelService', { useClass: LevelService });
container.register('ITechnologyService', { useClass: TechnologyService });

container.register('IAdminUserService', {
  useClass: AdminUserService
});

container.register('IAuditService', {
  useClass: AuditService
});

export { container };