import { IJobHandler } from '../IJobHandler';
import { container, inject, injectable } from 'tsyringe';
import { IAiProvider } from '../../interview/types';
import { IInterviewRepository } from '../../../repositories/IInterviewRepository';
import { InterviewContext } from '../../interview/InterviewContext';
import { IEventPublisher } from '../../events/IEventPublisher';

interface EvaluateAnswersData {
  interviewId: string;
  data: any;
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
    console.log(`[Job] EVALUATE_ANSWERS running for interview: ${data.interviewId}`);
    
    // Check state
    const session = await this.repository.findById(data.interviewId);
    if (!session || session.status !== 'EVALUATING') {
      console.warn(`[Job] Interview ${data.interviewId} is not in EVALUATING state. Aborting job.`);
      return;
    }
    
    if (!session.questions) {
      throw new Error(`[Job] Cannot find questions for interview ${data.interviewId}`);
    }

    try {
      const { data: evaluationResult, audit } = await this.aiProvider.evaluateAnswers(session.questions, data.data);
      
      // Save feedback
      for (const evalResult of evaluationResult.evaluations) {
         await this.repository.updateQuestionFeedback(evalResult.questionId, evalResult.feedback, evalResult.score);
      }
      
      // Save overallScore and learningPath
      await this.repository.update(data.interviewId, { 
         overallScore: evaluationResult.overallScore,
         learningPath: evaluationResult.learningPath 
      });

      // Save token usage
      await this.repository.updateTokenUsage(data.interviewId, audit);
      
      // Transition state
      const context = new InterviewContext(data.interviewId, this.repository, undefined, this.eventPublisher);
      const { CompletedState } = await import('../../interview/states/CompletedState');
      await context.changeState(new CompletedState());
      
      console.log(`[Job] EVALUATE_ANSWERS completed for interview: ${data.interviewId}`);
    } catch (error) {
      console.error(`[Job] EVALUATE_ANSWERS failed for interview: ${data.interviewId}`, error);
      
      const context = new InterviewContext(data.interviewId, this.repository, undefined, this.eventPublisher);
      const { FailedState } = await import('../../interview/states/FailedState');
      await context.changeState(new FailedState());
      
      throw error;
    }
  }
}
