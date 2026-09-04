import {
  IJobHandler
} from '../IJobHandler';

import {
  inject,
  injectable
} from 'tsyringe';

import {
  IAiProvider,
  AnswerPayload,
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

interface EvaluateAnswersData {
  interviewId: string;
  data: AnswerPayload[];
  systemPrompt?: SystemPromptContext;
  learningPathPrompt?: SystemPromptContext;
}

@injectable()
export class EvaluateAnswersJobHandler
  implements IJobHandler<EvaluateAnswersData>
{
  public readonly name =
    'EVALUATE_ANSWERS';

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
    data: EvaluateAnswersData
  ): Promise<void> {
    console.log(
      `[Job] EVALUATE_ANSWERS running for interview: ${data.interviewId}`
    );

    // Check state
    const session =
      await this.repository.findById(
        data.interviewId
      );

    if (
      !session ||
      session.status !== 'EVALUATING'
    ) {
      console.warn(
        `[Job] Interview ${data.interviewId} is not in EVALUATING state. Aborting job.`
      );
      return;
    }

    if (!session.questions) {
      throw new Error(
        `[Job] Cannot find questions for interview ${data.interviewId}`
      );
    }

    try {
      /*
       * ADM-04:
       * Evaluation must use the managed published
       * evaluation system prompt.
       */
      if (!data.systemPrompt) {
        throw new Error(
          'SYSTEM_PROMPT_NOT_AVAILABLE'
        );
      }

      const {
        data: evaluationResult,
        audit
      } =
        await this.aiProvider.evaluateAnswers(
          session.questions,
          data.data,
          data.systemPrompt
        );

      /*
       * Save feedback for every answer.
       */
      for (
        const evalResult of
          evaluationResult.evaluations
      ) {
        await this.repository
          .updateQuestionFeedback(
            evalResult.questionId,
            evalResult.feedback,
            evalResult.score
          );
      }

      /*
       * Default learning path comes from
       * the evaluation result.
       */
      let learningPath =
        evaluationResult.learningPath;

      /*
       * ADM-04:
       * If a dedicated LEARNING_PATH prompt
       * is available, run a separate AI call.
       */
      if (
        data.learningPathPrompt
      ) {
        const {
          data: learningPathResult,
          audit:
            learningPathAudit
        } =
          await this.aiProvider
            .generateLearningPath(
              session.questions,
              data.data,
              evaluationResult,
              data.learningPathPrompt
            );

        learningPath =
          learningPathResult.learningPath;

        /*
         * Add learning-path token usage.
         */
        await this.repository
          .updateTokenUsage(
            data.interviewId,
            learningPathAudit
          );

        /*
         * Store the exact learning-path
         * prompt version used.
         */
        await this.repository
          .updatePromptVersion(
            data.interviewId,
            'learningPath',
            {
              promptId:
                data.learningPathPrompt
                  .promptId,

              version:
                data.learningPathPrompt
                  .version,

              language:
                data.learningPathPrompt
                  .language
            }
          );
      }

      /*
       * Save overall score and final learning path.
       */
      await this.repository.update(
        data.interviewId,
        {
          overallScore:
            evaluationResult.overallScore,

          learningPath
        }
      );

      /*
       * Save evaluation token usage.
       */
      await this.repository
        .updateTokenUsage(
          data.interviewId,
          audit
        );

      /*
       * Store the exact evaluation
       * prompt version used.
       */
      await this.repository
        .updatePromptVersion(
          data.interviewId,
          'evaluation',
          {
            promptId:
              data.systemPrompt.promptId,

            version:
              data.systemPrompt.version,

            language:
              data.systemPrompt.language
          }
        );

      // Transition state
      const context =
        new InterviewContext(
          data.interviewId,
          this.repository,
          undefined,
          this.eventPublisher
        );

      const {
        CompletedState
      } = await import(
        '../../interview/states/CompletedState'
      );

      await context.changeState(
        new CompletedState()
      );

      console.log(
        `[Job] EVALUATE_ANSWERS completed for interview: ${data.interviewId}`
      );
    } catch (error) {
      console.error(
        `[Job] EVALUATE_ANSWERS failed for interview: ${data.interviewId}`,
        error
      );

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