import { IJobHandler } from '../IJobHandler';
import { inject, injectable } from 'tsyringe';
import { IAiProvider } from '../../interview/types';
import { IInterviewRepository } from '../../../repositories/IInterviewRepository';
import { InterviewContext } from '../../interview/InterviewContext';
import { IEventPublisher } from '../../events/IEventPublisher';
import { logger } from '../../../infrastructure/logging/logger';
import { evaluateSafely } from '../../../services/ai/prompt-security';
import { interviewJobData } from '../../../services/ai/job-security';

interface EvaluateAnswersData {
  interviewId: string;
  ownerId: string;
  requestId?: string;
}

@injectable()
export class EvaluateAnswersJobHandler implements IJobHandler<EvaluateAnswersData> {
  public readonly name = 'EVALUATE_ANSWERS';

  constructor(
    @inject('IAiProvider') private readonly aiProvider: IAiProvider,
    @inject('IInterviewRepository') private readonly repository: IInterviewRepository,
    @inject('IEventPublisher') private readonly eventPublisher?: IEventPublisher,
  ) {}

  async handle(input: EvaluateAnswersData): Promise<void> {
    const data = interviewJobData(input);
    const repository = this.repository.forOwner(data.ownerId);
    logger.info('job.started', {
      jobName: this.name,
      resourceType: 'interview',
      resourceId: data.interviewId,
    });

    const session = await repository.findById(data.interviewId);
    if (!session || session.status !== 'EVALUATING') {
      logger.warn('job.skipped', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: data.interviewId,
      });
      return;
    }
    if (!session.questions) {
      throw new Error('Cannot find questions for this session.');
    }

    try {
      const answers = session.questions.map((question) => ({
        questionId: question.id,
        candidateAnswer: question.candidateAnswer ?? '',
      }));
      const { data: evaluationResult, audit } = await evaluateSafely(
        this.aiProvider,
        session.questions,
        answers,
      );

      for (const evaluation of evaluationResult.evaluations) {
        await repository.updateQuestionFeedback(
          evaluation.questionId,
          evaluation.feedback,
          evaluation.score,
          data.interviewId,
        );
      }
      await repository.update(data.interviewId, {
        overallScore: evaluationResult.overallScore,
        dimensions: evaluationResult.dimensions,
        learningPath: evaluationResult.learningPath,
      });
      await repository.updateTokenUsage(data.interviewId, audit);

      const context = new InterviewContext(
        data.interviewId,
        repository,
        InterviewContext.createStateFromStatus(session.status),
        this.eventPublisher,
        session.version,
      );
      const { CompletedState } = await import('../../interview/states/CompletedState');
      await context.changeState(new CompletedState());
      logger.info('job.completed', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: data.interviewId,
      });
    } catch (error) {
      logger.error('job.failed', {
        jobName: this.name,
        resourceType: 'interview',
        resourceId: data.interviewId,
      });
      const context = new InterviewContext(
        data.interviewId,
        repository,
        InterviewContext.createStateFromStatus(session.status),
        this.eventPublisher,
        session.version,
      );
      const { FailedState } = await import('../../interview/states/FailedState');
      await context.changeState(new FailedState());
      throw error;
    }
  }
}
