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
}

@injectable()
export class EvaluateAnswersJobHandler implements IJobHandler<EvaluateAnswersData> {
  public readonly name = 'EVALUATE_ANSWERS';

  constructor(
    @inject('IAiProvider') private aiProvider: IAiProvider,
    @inject('IInterviewRepository') private repository: IInterviewRepository,
    @inject('IEventPublisher') private eventPublisher?: IEventPublisher
  ) {}

  async handle(data: EvaluateAnswersData): Promise<void> {
    data = interviewJobData(data);
    const repository = this.repository.forOwner(data.ownerId);
    logger.info('job.started', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
    
    // Check state
    const session = await repository.findById(data.interviewId);
    if (!session || session.status !== 'EVALUATING') {
      logger.warn('job.skipped', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
      return;
    }
    
    if (!session.questions) {
      throw new Error(`[Job] Cannot find questions for interview ${data.interviewId}`);
    }

    try {
      const normalizedAnswers = session.questions.map(q => ({ questionId: q.id, candidateAnswer: q.candidateAnswer ?? '' }));
      const { data: evaluationResult, audit } = await evaluateSafely(this.aiProvider, session.questions, normalizedAnswers);
      
      // Save feedback
      for (const evalResult of evaluationResult.evaluations) {
         await repository.updateQuestionFeedback(evalResult.questionId, evalResult.feedback, evalResult.score, data.interviewId);
      }
      
      // Save overallScore, dimensions and learningPath
      await repository.update(data.interviewId, {
         overallScore: evaluationResult.overallScore,
         dimensions: evaluationResult.dimensions,
         learningPath: evaluationResult.learningPath 
      });

      // Save token usage
      await repository.updateTokenUsage(data.interviewId, audit);
      
      // Transition state
      const context = new InterviewContext(data.interviewId, repository, undefined, this.eventPublisher);
      const { CompletedState } = await import('../../interview/states/CompletedState');
      await context.changeState(new CompletedState());
      
      logger.info('job.completed', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
    } catch (error) {
      logger.error('job.failed', { jobName: this.name, resourceType: 'interview', resourceId: data.interviewId });
      
      const context = new InterviewContext(data.interviewId, repository, undefined, this.eventPublisher);
      const { FailedState } = await import('../../interview/states/FailedState');
      await context.changeState(new FailedState());
      
      throw error;
    }
  }
}
