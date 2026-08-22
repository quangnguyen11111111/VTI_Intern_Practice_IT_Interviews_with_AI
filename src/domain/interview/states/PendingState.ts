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
    
    // Khởi động quá trình sinh câu hỏi (có thể thông qua AI Service được inject vào payload hoặc context)
    // Ở đây ta gọi hàm trigger logic phía service
    try {
      if (payload && payload.aiService) {
         await payload.aiService.generateQuestions(context.getInterviewId(), payload.setupData);
      }
      // If success, transition to InProgressState
      const { InProgressState } = await import('./InProgressState');
      await context.changeState(new InProgressState());
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
}
