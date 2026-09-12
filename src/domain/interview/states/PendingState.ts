import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';
import { GeneratingState } from './GeneratingState';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { GeneratePayload, SubmitPayload, SaveProgressPayload } from '../types';
import { generateSafely } from '../../../services/ai/prompt-security';
import { resolveGenerationSetup } from '../../../services/ai/job-security';
import { logger } from '../../../infrastructure/logging/logger';

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
    logger.info('interview.generating', {
      resourceType: 'interview',
      resourceId: context.getInterviewId()
    });
    // Transition to Generating State
    await context.changeState(
      new GeneratingState()
    );

    try {
      if (
        payload.useAsyncJobs !== false &&
        payload.jobScheduler
      ) {
        await payload.jobScheduler.enqueue('GENERATE_QUESTIONS', {
          interviewId: context.getInterviewId(),
          ownerId: context.getRepository().getOwnerId(),
        });

        return;
      }

      if (payload.aiProvider) {
        const { data: generatedQuestions, audit } = await generateSafely(
          payload.aiProvider,
          await resolveGenerationSetup(payload.setupData),
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

        const {
          InProgressState
        } = await import(
          './InProgressState'
        );

        await context.changeState(
          new InProgressState()
        );
      } else {
        throw new Error('AI_PROVIDER_NOT_AVAILABLE');
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
