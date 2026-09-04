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
    console.log(
      `[Job] GENERATE_QUESTIONS running for interview: ${data.interviewId}`
    );

    // Check if interview is still in GENERATING state.
    const session =
      await this.repository.findById(
        data.interviewId
      );

    if (
      !session ||
      session.status !== 'GENERATING'
    ) {
      console.warn(
        `[Job] Interview ${data.interviewId} is not in GENERATING state. Aborting job.`
      );
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

      console.log(
        `[Job] GENERATE_QUESTIONS completed for interview: ${data.interviewId}`
      );
    } catch (error) {
      console.error(
        `[Job] GENERATE_QUESTIONS failed for interview: ${data.interviewId}`,
        error
      );

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