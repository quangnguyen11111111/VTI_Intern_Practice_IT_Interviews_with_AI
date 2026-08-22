import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';

import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { EvaluatingState } from './EvaluatingState';
import { GeneratePayload, SubmitPayload } from '../types';

export class InProgressState implements IInterviewState {
  getName(): InterviewStatus {
    return 'IN_PROGRESS';
  }

  async generate(context: InterviewContext, payload: GeneratePayload): Promise<void> {
    throw new InvalidStateTransitionException('Questions have already been generated. The interview is currently IN_PROGRESS.');
  }

  async submit(context: InterviewContext, payload: SubmitPayload): Promise<void> {
    console.log(`[InProgressState] Submitting answers for interview: ${context.getInterviewId()}`);
    
    // Chuyển sang trạng thái chấm bài
    await context.changeState(new EvaluatingState());
    
    // Gọi logic AI chấm bài ở đây
    try {
      if (payload && payload.aiService) {
         await payload.aiService.evaluateAnswers(context.getInterviewId(), payload.data);
      }
      // Success -> COMPLETED
      const { CompletedState } = await import('./CompletedState');
      await context.changeState(new CompletedState());
    } catch (error) {
      // Fail -> FAILED
      const { FailedState } = await import('./FailedState');
      await context.changeState(new FailedState());
      throw error;
    }
  }
}
