import {
  IInterviewState,
  InterviewStatus
} from '../IInterviewState';

import {
  InterviewContext
} from '../InterviewContext';

import {
  GeneratingState
} from './GeneratingState';

import {
  InvalidStateTransitionException
} from '../exceptions/InvalidStateTransitionException';

import {
  GeneratePayload,
  SubmitPayload,
  SaveProgressPayload
} from '../types';

export class PendingState
  implements IInterviewState
{
  getName(): InterviewStatus {
    return 'PENDING';
  }

  async generate(
    context: InterviewContext,
    payload: GeneratePayload
  ): Promise<void> {
    console.log(
      `[PendingState] Generating questions for interview: ${context.getInterviewId()}`
    );

    // Transition to Generating State
    await context.changeState(
      new GeneratingState()
    );

    try {
      /*
       * main:
       * Prefer background job execution when a scheduler
       * is available.
       *
       * ADM-04:
       * Pass the selected system prompt along with the job
       * so the exact prompt/version can still be used by
       * the async generation flow.
       *
       * Test environment:
       * Keep the synchronous MockAiProvider flow so
       * integration tests remain deterministic and do not
       * require Agenda to be started.
       */
      if (
        process.env.NODE_ENV !== 'test' &&
        payload &&
        payload.jobScheduler
      ) {
        await payload.jobScheduler.enqueue(
          'GENERATE_QUESTIONS',
          {
            interviewId:
              context.getInterviewId(),

            setupData:
              payload.setupData,

            systemPrompt:
              payload.systemPrompt
          }
        );

        return;
      }

      /*
       * Fallback synchronous generation.
       */
      if (
        payload &&
        payload.aiProvider
      ) {
        /*
         * ADM-04:
         * Managed prompt is required for generation.
         */
        if (!payload.systemPrompt) {
          throw new Error(
            'SYSTEM_PROMPT_NOT_AVAILABLE'
          );
        }

        const {
          data: generatedQuestions,
          audit
        } =
          await payload.aiProvider.generateQuestions(
            payload.setupData,
            payload.systemPrompt
          );

        await context
          .getRepository()
          .createQuestions(
            context.getInterviewId(),
            generatedQuestions
          );

        await context
          .getRepository()
          .updateTokenUsage(
            context.getInterviewId(),
            audit
          );

        /*
         * Store the exact system prompt version
         * used for this generation run.
         */
        await context
          .getRepository()
          .updatePromptVersion(
            context.getInterviewId(),
            'generation',
            {
              promptId:
                payload.systemPrompt
                  .promptId,

              version:
                payload.systemPrompt
                  .version,

              language:
                payload.systemPrompt
                  .language
            }
          );

        /*
         * Synchronous fallback succeeds immediately.
         */
        const {
          InProgressState
        } = await import(
          './InProgressState'
        );

        await context.changeState(
          new InProgressState()
        );
      }
    } catch (error) {
      // If fail, transition to FailedState
      const {
        FailedState
      } = await import(
        './FailedState'
      );

      await context.changeState(
        new FailedState()
      );

      throw error;
    }
  }

  async submit(
    _context: InterviewContext,
    _payload: SubmitPayload
  ): Promise<void> {
    throw new InvalidStateTransitionException(
      'Cannot submit answers while in PENDING state.'
    );
  }

  async saveProgress(
    _context: InterviewContext,
    _payload: SaveProgressPayload
  ): Promise<void> {
    throw new InvalidStateTransitionException(
      'Cannot save progress while in PENDING state.'
    );
  }
}

