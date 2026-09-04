import { IJobHandler } from '../IJobHandler';
import { container, inject, injectable } from 'tsyringe';
import { IAiProvider } from '../../interview/types';
import { IInterviewRepository } from '../../../repositories/IInterviewRepository';
import { InterviewContext } from '../../interview/InterviewContext';
import { IEventPublisher } from '../../events/IEventPublisher';

interface GenerateQuestionData {
  interviewId: string;
  setupData: any;
}

@injectable()
export class GenerateQuestionJobHandler implements IJobHandler<GenerateQuestionData> {
  public readonly name = 'GENERATE_QUESTIONS';

  constructor(
    @inject('IAiProvider') private aiProvider: IAiProvider,
    @inject('IInterviewRepository') private repository: IInterviewRepository,
    @inject('IEventPublisher') private eventPublisher?: IEventPublisher
  ) {}

  async handle(data: GenerateQuestionData): Promise<void> {
    console.log(`[Job] GENERATE_QUESTIONS running for interview: ${data.interviewId}`);
    
    // Check if interview is still in GENERATING state (sanity check)
    const session = await this.repository.findById(data.interviewId);
    if (!session || session.status !== 'GENERATING') {
      console.warn(`[Job] Interview ${data.interviewId} is not in GENERATING state. Aborting job.`);
      return;
    }

    try {
      const { data: generatedQuestions, audit } = await this.aiProvider.generateQuestions(data.setupData);
      
      // Update DB
      await this.repository.createQuestions(data.interviewId, generatedQuestions);
      await this.repository.updateTokenUsage(data.interviewId, audit);

      // Transition state
      const context = new InterviewContext(data.interviewId, this.repository, undefined, this.eventPublisher);
      const { InProgressState } = await import('../../interview/states/InProgressState');
      await context.changeState(new InProgressState());
      
      console.log(`[Job] GENERATE_QUESTIONS completed for interview: ${data.interviewId}`);
    } catch (error) {
      console.error(`[Job] GENERATE_QUESTIONS failed for interview: ${data.interviewId}`, error);
      
      // Transition to FAILED state
      const context = new InterviewContext(data.interviewId, this.repository, undefined, this.eventPublisher);
      const { FailedState } = await import('../../interview/states/FailedState');
      await context.changeState(new FailedState());
      
      throw error; // Let agenda know it failed
    }
  }
}
