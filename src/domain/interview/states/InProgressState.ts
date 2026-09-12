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
  SubmitPayload,
  SaveProgressPayload
} from '../types';
import { evaluateSafely } from '../../../services/ai/prompt-security';
import { logger } from '../../../infrastructure/logging/logger';

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
    logger.info('interview.submitting', { resourceType: 'interview', resourceId: context.getInterviewId() });

    // Chuyển sang trạng thái chấm bài
    await context.changeState(
      new EvaluatingState()
    );

    try {
      if (payload.useAsyncJobs !== false && payload.jobScheduler) {
        await payload.jobScheduler.enqueue('EVALUATE_ANSWERS', {
          interviewId: context.getInterviewId(),
          ownerId: context.getRepository().getOwnerId(),
        });

        return;
      }

      /*
       * Fallback synchronous evaluation.
       */
      if (payload.aiProvider) {
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

        const { data: evaluationResult, audit } = await evaluateSafely(
          payload.aiProvider,
          session.questions,
          payload.data,
        );

        /*
         * Save feedback cho từng câu trả lời.
         */
        for (
          const evalResult of
            evaluationResult.evaluations
        ) {
          await context
            .getRepository()
            .updateQuestionFeedback(
              evalResult.questionId,
              evalResult.feedback,
              evalResult.score,
              context.getInterviewId()
            );
        }

        const learningPath = evaluationResult.learningPath;

        /*
         * Save overall score và learning path.
         */
          await context
            .getRepository()
            .update(
            context.getInterviewId(),
            {
              overallScore:
                evaluationResult.overallScore,

              dimensions:
                evaluationResult.dimensions,

              learningPath
            }
          );

        /*
         * Save token usage của evaluation.
         */
        await context
          .getRepository()
          .updateTokenUsage(
            context.getInterviewId(),
            audit
          );

        // Success -> COMPLETED
        const {
          CompletedState
        } = await import(
          './CompletedState'
        );

        await context.changeState(
          new CompletedState()
        );
      }
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

  async saveProgress(
    context: InterviewContext,
    payload: SaveProgressPayload
  ): Promise<void> {
    logger.info('interview.saving', { resourceType: 'interview', resourceId: context.getInterviewId() });

    /*
     * Lưu câu trả lời nhưng không chuyển state.
     */
    for (
      const answer of payload.answers
    ) {
      await context
        .getRepository()
        .updateQuestionAnswer(
          answer.questionId,
          answer.candidateAnswer,
          context.getInterviewId()
        );
    }
  }
}
