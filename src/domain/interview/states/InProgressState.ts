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
      /*
       * main:
       * Khi có jobScheduler thì ưu tiên queue background job.
       *
       * ADM-04:
       * Truyền evaluation prompt và learning-path prompt
       * cùng payload để background handler có thể sử dụng
       * đúng prompt version đã được chọn.
       *
       * Test environment:
       * Không queue Agenda vì test integration không start
       * background scheduler. Khi test sẽ dùng synchronous
       * MockAiProvider ở bên dưới.
       */
      if (
        process.env.NODE_ENV !== 'test' &&
        payload &&
        payload.jobScheduler
      ) {
        await payload.jobScheduler.enqueue(
          'EVALUATE_ANSWERS',
          {
            interviewId:
              context.getInterviewId(),

            data:
              payload.data,

            systemPrompt:
              payload.systemPrompt,

            learningPathPrompt:
              payload.learningPathPrompt
          }
        );

        return;
      }

      /*
       * Fallback synchronous evaluation.
       */
      if (
        payload &&
        payload.aiProvider
      ) {
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
         * Evaluation phải dùng managed published prompt.
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
          await payload.aiProvider
            .evaluateAnswers(
              session.questions,
              payload.data,
              payload.systemPrompt
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
              evalResult.score
            );
        }

        /*
         * Mặc định giữ learning path từ
         * evaluation result để backward compatible.
         *
         * Nếu có published LEARNING_PATH prompt,
         * sẽ generate lại bằng AI operation riêng.
         */
        let learningPath =
          evaluationResult.learningPath;

        /*
         * ADM-04:
         * Learning Path dùng prompt riêng nếu có.
         */
        if (
          payload.learningPathPrompt
        ) {
          const {
            data: learningPathResult,
            audit:
              learningPathAudit
          } =
            await payload.aiProvider
              .generateLearningPath(
                session.questions,
                payload.data,
                evaluationResult,
                payload.learningPathPrompt
              );

          learningPath =
            learningPathResult.learningPath;

          /*
           * Cộng token usage của learning-path call.
           */
          await context
            .getRepository()
            .updateTokenUsage(
              context.getInterviewId(),
              learningPathAudit
            );

          /*
           * Lưu chính xác prompt version đã dùng.
           */
          await context
            .getRepository()
            .updatePromptVersion(
              context.getInterviewId(),
              'learningPath',
              {
                promptId:
                  payload
                    .learningPathPrompt
                    .promptId,

                version:
                  payload
                    .learningPathPrompt
                    .version,

                language:
                  payload
                    .learningPathPrompt
                    .language
              }
            );
        }

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

        /*
         * Lưu chính xác evaluation prompt version.
         */
        await context
          .getRepository()
          .updatePromptVersion(
            context.getInterviewId(),
            'evaluation',
            {
              promptId:
                payload
                  .systemPrompt
                  .promptId,

              version:
                payload
                  .systemPrompt
                  .version,

              language:
                payload
                  .systemPrompt
                  .language
            }
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
    console.log(
      `[InProgressState] Saving progress for interview: ${context.getInterviewId()}`
    );

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
          answer.candidateAnswer
        );
    }
  }
}

