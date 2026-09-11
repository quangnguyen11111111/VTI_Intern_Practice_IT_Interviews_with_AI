import { IJobHandler } from '../IJobHandler';
import { inject, injectable } from 'tsyringe';
import { IAiProvider } from '../../interview/types';
import { IInterviewRepository } from '../../../repositories/IInterviewRepository';
import { InterviewContext } from '../../interview/InterviewContext';
import { IEventPublisher } from '../../events/IEventPublisher';
import { logger } from '../../../infrastructure/logging/logger';
import { generateSafely } from '../../../services/ai/prompt-security';
import { interviewJobData, resolveGenerationSetup } from '../../../services/ai/job-security';

interface GenerateQuestionData {
  interviewId: string;
  ownerId: string;
}

@injectable()
export class GenerateQuestionJobHandler implements IJobHandler<GenerateQuestionData> {
  public readonly name = 'GENERATE_QUESTIONS';

  constructor(
    @inject('IAiProvider') private aiProvider: IAiProvider,
    @inject('IInterviewRepository') private repository: IInterviewRepository,
    @inject('IEventPublisher') private eventPublisher?: IEventPublisher
  ) {}

  async handle(data: GenerateQuestionData): Promise<void> {
    data = interviewJobData(data);
    const repository = this.repository.forOwner(data.ownerId);
    logger.info('job.started', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
    
    // Check if interview is still in GENERATING state (sanity check)
    const session = await repository.findById(data.interviewId);
    if (!session || session.status !== 'GENERATING') {
      logger.warn('job.skipped', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
      return;
    }

    try {
      const { data: generatedQuestions, audit } = await generateSafely(this.aiProvider, await resolveGenerationSetup(session.setupData));
      
      // Update DB
      await repository.createQuestions(data.interviewId, generatedQuestions);
      await repository.updateTokenUsage(data.interviewId, audit);

      // Transition state
      const context = new InterviewContext(data.interviewId, repository, undefined, this.eventPublisher);
      const { InProgressState } = await import('../../interview/states/InProgressState');
      await context.changeState(new InProgressState());
      
      logger.info('job.completed', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
    } catch (error) {
      logger.error('job.failed', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
      
      // Transition to FAILED state
      const context = new InterviewContext(data.interviewId, repository, undefined, this.eventPublisher);
      const { FailedState } = await import('../../interview/states/FailedState');
      await context.changeState(new FailedState());
      
      throw error; // Let agenda know it failed
    }
  }
}
