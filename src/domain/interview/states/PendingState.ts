import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';
import { GeneratingState } from './GeneratingState';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { GeneratePayload, SubmitPayload } from '../types';

export class PendingState implements IInterviewState {
  getName(): InterviewStatus {
    return 'PENDING';
  }

  async generate(context: InterviewContext, payload: GeneratePayload): Promise<void> {
    console.log(`[PendingState] Generating questions for interview: ${context.getInterviewId()}`);
    // Transition to Generating State
    await context.changeState(new GeneratingState());
    
    // Ở đây ta gọi hàm trigger logic phía service hoặc job scheduler
    try {
      if (payload && payload.jobScheduler) {
         // Queue job Instead of waiting for AI directly
         await payload.jobScheduler.enqueue('GENERATE_QUESTIONS', {
           interviewId: context.getInterviewId(),
           setupData: payload.setupData
         });
      } else if (payload && payload.aiProvider) {
         // Fallback to sync generation if no scheduler
         const { data: generatedQuestions, audit } = await payload.aiProvider.generateQuestions(payload.setupData);
         await context.getRepository().createQuestions(context.getInterviewId(), generatedQuestions);
         await context.getRepository().updateTokenUsage(context.getInterviewId(), audit);
         const { InProgressState } = await import('./InProgressState');
         await context.changeState(new InProgressState());
      }
    } catch (error) {
      // If fail, transition to FailedState
      const { FailedState } = await import('./FailedState');
      await context.changeState(new FailedState());
      throw error;
    }
  }

  async submit(context: InterviewContext, payload: SubmitPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot submit answers while in PENDING state.');
  }

  async saveProgress(context: InterviewContext, payload: import('../types').SaveProgressPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot save progress while in PENDING state.');
  }
}
