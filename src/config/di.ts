import { container } from 'tsyringe';

import { getEnv } from './env';

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

import { SystemPromptRepository } from '../repositories/system-prompt.repository';

import { AdminMetricsRepository } from '../repositories/admin-metrics.repository';

import { ApiRateLimitRepository } from '../repositories/api-rate-limit.repository';

import { InterviewQuotaRepository } from '../repositories/interview-quota.repository';

import { PlanRepository } from '../repositories/plan.repository';

import { PaymentAttemptRepository } from '../repositories/payment-attempt.repository';

import { SubscriptionRepository } from '../repositories/subscription.repository';

import { EntitlementRepository } from '../repositories/entitlement.repository';

import { PaymentEventRepository } from '../repositories/payment-event.repository';

// Services

import { RoleService } from '../services/role.service';

import { LevelService } from '../services/level.service';

import { TechnologyService } from '../services/technology.service';

import { InterviewService } from '../services/InterviewService';

import { SystemPromptService } from '../services/system-prompt.service';

import { AdminMetricsService } from '../services/admin-metrics.service';

import { InterviewQuotaService } from '../services/interview-quota.service';

import { PaymentService } from '../services/payment.service';

import { PaymentEventProcessor } from '../services/payment-event-processor.service';

// Payment Gateways

import { MockPaymentGateway } from '../services/payment/MockPaymentGateway';

import { StripePaymentGateway } from '../services/payment/StripePaymentGateway';

import { VnPayPaymentGateway } from '../services/payment/VnPayPaymentGateway';

import { ConfiguredPaymentGateway } from '../services/payment/ConfiguredPaymentGateway';

// AI Providers

import { MockAiProvider } from '../services/ai/providers/MockAiProvider';

import { GeminiAiProvider } from '../services/ai/providers/GeminiAiProvider';

import { AdminUserService } from '../services/admin-user.service';

import { AuditService } from '../services/audit.service';

import { EvaluateAnswersJobHandler } from '../domain/jobs/handlers/EvaluateAnswersJobHandler';

import { InterviewOperationProcessor } from '../services/InterviewOperationProcessor';

import { OutboxDispatcher } from '../infrastructure/jobs/OutboxDispatcher';

// Background Jobs

import { PaymentReconciliationJobHandler } from '../domain/jobs/handlers/PaymentReconciliationJobHandler';

// Register Repositories

container.register('IRoleRepository', {
  useClass: RoleRepository,
});

container.register('ILevelRepository', {
  useClass: LevelRepository,
});

container.register('ITechnologyRepository', {
  useClass: TechnologyRepository,
});

container.register('IInterviewRepository', {
  useFactory: () => new MongoInterviewRepository(),
});

container.register('IInterviewHistoryRepository', {
  useFactory: () => new MongoInterviewRepository(),
});

container.register('IInterviewAnalyticsRepository', {
  useFactory: () => new MongoInterviewRepository(),
});

container.register('IApiRateLimitRepository', {
  useClass: ApiRateLimitRepository,
});

container.register('IInterviewQuotaRepository', {
  useClass: InterviewQuotaRepository,
});

container.register('IPlanRepository', {
  useClass: PlanRepository,
});

container.register('IPaymentAttemptRepository', {
  useClass: PaymentAttemptRepository,
});

container.register('ISubscriptionRepository', {
  useClass: SubscriptionRepository,
});

container.register('IEntitlementRepository', {
  useClass: EntitlementRepository,
});

container.register('IPaymentEventRepository', {
  useClass: PaymentEventRepository,
});

container.register('MockPaymentGateway', {
  useClass: MockPaymentGateway,
});

container.register('StripePaymentGateway', {
  useClass: StripePaymentGateway,
});

container.register('VnPayPaymentGateway', {
  useClass: VnPayPaymentGateway,
});

container.register('IPaymentGateway', {
  useClass: ConfiguredPaymentGateway,
});

// Register AI Provider based on .env

const env = getEnv();

container.register('AppEnv', { useValue: env });

if (env.NODE_ENV === 'test') {
  container.register('IAiProvider', {
    useClass: MockAiProvider,
  });
} else {
  container.register('IAiProvider', {
    useClass: GeminiAiProvider,
  });
}

// Background Jobs

container.register('OperationProcessorOptions', { useValue: {} });

container.register('OutboxDispatcherOptions', { useValue: {} });

container.registerSingleton('IJobScheduler', AgendaJobScheduler);

container.registerSingleton(InterviewOperationProcessor);

container.registerSingleton(OutboxDispatcher);

container.registerSingleton(GenerateQuestionJobHandler);

container.registerSingleton(EvaluateAnswersJobHandler);

container.registerSingleton(PaymentReconciliationJobHandler);

// Event Bus

container.registerSingleton('IEventPublisher', InterviewEventBus);

container.register('IUserRepository', {
  useClass: UserRepository,
});

container.register('IAuditRepository', {
  useClass: AuditRepository,
});

container.register('ISystemPromptRepository', {
  useClass: SystemPromptRepository,
});

container.register('IAdminMetricsRepository', {
  useClass: AdminMetricsRepository,
});

// Register Services

container.register('IRoleService', {
  useClass: RoleService,
});

container.register('ILevelService', {
  useClass: LevelService,
});

container.register('ITechnologyService', {
  useClass: TechnologyService,
});

container.register('IAdminUserService', {
  useClass: AdminUserService,
});

container.register('IAuditService', {
  useClass: AuditService,
});

container.register('ISystemPromptService', {
  useClass: SystemPromptService,
});

container.register('IAdminMetricsService', {
  useClass: AdminMetricsService,
});

container.register('IInterviewQuotaService', {
  useClass: InterviewQuotaService,
});

container.register('IPaymentEventProcessor', {
  useClass: PaymentEventProcessor,
});

container.register('IPaymentService', {
  useClass: PaymentService,
});

export { container };