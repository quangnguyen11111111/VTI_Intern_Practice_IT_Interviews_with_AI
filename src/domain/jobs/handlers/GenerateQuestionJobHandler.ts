import { IJobHandler } from '../IJobHandler';
import { inject, injectable } from 'tsyringe';
import { InterviewOperationProcessor } from '../../../services/InterviewOperationProcessor';
import { IAiProvider } from '../../interview/types';
import { IInterviewRepository } from '../../../repositories/IInterviewRepository';
import { InterviewContext } from '../../interview/InterviewContext';
import { IEventPublisher } from '../../events/IEventPublisher';
import { logger } from '../../../infrastructure/logging/logger';
import { generateSafely } from '../../../services/ai/prompt-security';
import { interviewJobData, resolveGenerationSetup } from '../../../services/ai/job-security';

type GenerateQuestionData =
  | { operationId: string }
  | { interviewId: string; ownerId: string; requestId?: string };

@injectable()
export class GenerateQuestionJobHandler
  implements IJobHandler<GenerateQuestionData>
{
  public readonly name =
    'GENERATE_QUESTIONS';

  constructor(
    @inject(InterviewOperationProcessor)
    private readonly processorOrProvider: InterviewOperationProcessor | IAiProvider,
    @inject('IInterviewRepository')
    private readonly repository?: IInterviewRepository,
    @inject('IEventPublisher')
    private readonly eventPublisher?: IEventPublisher,
  ) {}

  async handle(data: GenerateQuestionData): Promise<void> {
    if ('operationId' in data) {
      await (this.processorOrProvider as InterviewOperationProcessor).process(
        data.operationId,
        'GENERATE_QUESTIONS',
      );
      return;
    }

    const provider = this.processorOrProvider as IAiProvider;
    if (!this.repository) throw new Error('Interview repository is not configured');
    const normalized = interviewJobData(data);
    const repository = this.repository.forOwner(normalized.ownerId);
    logger.info('job.started', {
      jobName: this.name,
      resourceType: 'interview',
      resourceId: normalized.interviewId,
    });

    const session = await repository.findById(normalized.interviewId);
    if (!session || session.status !== 'GENERATING') {
      logger.warn('job.skipped', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: normalized.interviewId,
      });
      return;
    }

    try {
      const { data: generatedQuestions, audit } = await generateSafely(
        provider,
        await resolveGenerationSetup(session.setupData),
      );
      await repository.createQuestions(normalized.interviewId, generatedQuestions);
      await repository.updateTokenUsage(normalized.interviewId, audit);

      const context = new InterviewContext(
        normalized.interviewId,
        repository,
        InterviewContext.createStateFromStatus(session.status),
        this.eventPublisher,
        session.version,
      );
      const { InProgressState } = await import('../../interview/states/InProgressState');
      await context.changeState(new InProgressState());
      logger.info('job.completed', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: normalized.interviewId,
      });
    } catch (error) {
      logger.error('job.failed', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: normalized.interviewId,
      });
      const context = new InterviewContext(
        normalized.interviewId,
        repository,
        InterviewContext.createStateFromStatus(session.status),
        this.eventPublisher,
        session.version,
      );
      const { FailedState } = await import('../../interview/states/FailedState');
      await context.changeState(new FailedState());
      throw error;
    }
  }
}
