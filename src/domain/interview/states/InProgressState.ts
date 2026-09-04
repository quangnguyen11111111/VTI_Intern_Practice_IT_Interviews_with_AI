import {
  IInterviewState,
  InterviewStatus
} from '../IInterviewState';

import {
  InterviewContext
} from '../InterviewContext';

import {
  InvalidStateTransitionException
} from '../exceptions/InvalidStateTransitionException';

import {
  EvaluatingState
} from './EvaluatingState';

import {
  GeneratePayload,
  SubmitPayload
} from '../types';

export class InProgressState
  implements IInterviewState
{
  getName(): InterviewStatus {
    return 'IN_PROGRESS';
  }

  async generate(
    _context: InterviewContext,
    _payload: GeneratePayload
  ): Promise<void> {
    throw new InvalidStateTransitionException(
      'Questions have already been generated. The interview is currently IN_PROGRESS.'
    );
  }

  async submit(
    context: InterviewContext,
    payload: SubmitPayload
  ): Promise<void> {
    console.log(
      `[InProgressState] Submitting answers for interview: ${context.getInterviewId()}`
    );

    // Chuyển sang trạng thái chấm bài
    await context.changeState(
      new EvaluatingState()
    );

    try {
      if (payload && payload.aiProvider) {
        const session =
          await context
            .getRepository()
            .findById(
              context.getInterviewId()
            );

        if (
          !session ||
          !session.questions
        ) {
          throw new Error(
            'Cannot find questions for this session.'
          );
        }

        /*
         * ADM-04:
         * Evaluation must use a managed published
         * system prompt.
         */
        if (!payload.systemPrompt) {
          throw new Error(
            'SYSTEM_PROMPT_NOT_AVAILABLE'
          );
        }

        const {
          data: evaluationResult,
          audit
        } =
          await payload.aiProvider.evaluateAnswers(
            session.questions,
            payload.data,
            payload.systemPrompt
          );

        // Save feedback
        for (
          const evalResult of
            evaluationResult.evaluations
        ) {
          await context
            .getRepository()
            .updateQuestionFeedback(
              evalResult.questionId,
              evalResult.feedback,
              evalResult.score
            );
        }

        // Save overall score and learning path
        await context
          .getRepository()
          .update(
            context.getInterviewId(),
            {
              overallScore:
                evaluationResult.overallScore,
              learningPath:
                evaluationResult.learningPath
            }
          );

        // Save token usage
        await context
          .getRepository()
          .updateTokenUsage(
            context.getInterviewId(),
            audit
          );

        /*
         * Store the exact evaluation prompt
         * version used by this AI run.
         */
        await context
          .getRepository()
          .updatePromptVersion(
            context.getInterviewId(),
            'evaluation',
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

      // Success -> COMPLETED
      const {
        CompletedState
      } = await import(
        './CompletedState'
      );

      await context.changeState(
        new CompletedState()
      );
    } catch (error) {
      // Fail -> FAILED
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
}