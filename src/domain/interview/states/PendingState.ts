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
  SubmitPayload
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
      if (payload && payload.aiProvider) {
        /*
         * ADM-04:
         * Generation must use a managed published
         * system prompt.
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
         * Store the exact prompt version used
         * by this generation run.
         */
        await context
          .getRepository()
          .updatePromptVersion(
            context.getInterviewId(),
            'generation',
            {
              promptId:
                payload.systemPrompt.promptId,
              version:
                payload.systemPrompt.version,
              language:
                payload.systemPrompt.language
            }
          );
      }

      // If success, transition to InProgressState
      const {
        InProgressState
      } = await import(
        './InProgressState'
      );

      await context.changeState(
        new InProgressState()
      );
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
}