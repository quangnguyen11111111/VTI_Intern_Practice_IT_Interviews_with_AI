import {
  IJobHandler
} from '../IJobHandler';
import {
  inject,
  injectable
} from 'tsyringe';

import {
  IAiProvider,
  SystemPromptContext
} from '../../interview/types';

import {
  IInterviewRepository
} from '../../../repositories/IInterviewRepository';

import {
  InterviewContext
} from '../../interview/InterviewContext';

import {
  IEventPublisher
} from '../../events/IEventPublisher';
import { logger } from '../../../infrastructure/logging/logger';

interface GenerateQuestionData {
  interviewId: string;
  setupData: any;
  systemPrompt?: SystemPromptContext;
}

@injectable()
export class GenerateQuestionJobHandler
  implements IJobHandler<GenerateQuestionData>
{
  public readonly name =
    'GENERATE_QUESTIONS';

  constructor(
    @inject('IAiProvider')
    private readonly aiProvider:
      IAiProvider,

    @inject('IInterviewRepository')
    private readonly repository:
      IInterviewRepository,

    @inject('IEventPublisher')
    private readonly eventPublisher?:
      IEventPublisher
  ) {}

  async handle(
    data: GenerateQuestionData
  ): Promise<void> {
    logger.info('job.started', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });

    // Check if interview is still in GENERATING state.
    const session =
      await this.repository.findById(
        data.interviewId
      );

    if (
      !session ||
      session.status !== 'GENERATING'
    ) {
      logger.warn('job.skipped', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
      return;
    }

    try {
      /*
       * ADM-04:
       * Generation must use the managed published
       * system prompt passed into the background job.
       */
      if (!data.systemPrompt) {
        throw new Error(
          'SYSTEM_PROMPT_NOT_AVAILABLE'
        );
      }

      const {
        data: generatedQuestions,
        audit
      } =
        await this.aiProvider.generateQuestions(
          data.setupData,
          data.systemPrompt
        );

      // Save generated questions.
      await this.repository.createQuestions(
        data.interviewId,
        generatedQuestions
      );

      // Save token usage.
      await this.repository.updateTokenUsage(
        data.interviewId,
        audit
      );

      /*
       * ADM-04:
       * Store the exact system prompt version
       * used by this AI execution.
       */
      await this.repository.updatePromptVersion(
        data.interviewId,
        'generation',
        {
          promptId:
            data.systemPrompt.promptId,

          version:
            data.systemPrompt.version,

          language:
            data.systemPrompt.language
        }
      );

      // Transition state.
      const context =
        new InterviewContext(
          data.interviewId,
          this.repository,
          undefined,
          this.eventPublisher
        );

      const {
        InProgressState
      } = await import(
        '../../interview/states/InProgressState'
      );

      await context.changeState(
        new InProgressState()
      );

      logger.info('job.completed', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
    } catch (error) {
      logger.error('job.failed', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });

      // Transition to FAILED state.
      const context =
        new InterviewContext(
          data.interviewId,
          this.repository,
          undefined,
          this.eventPublisher
        );

      const {
        FailedState
      } = await import(
        '../../interview/states/FailedState'
      );

      await context.changeState(
        new FailedState()
      );

      throw error;
    }
  }
}
