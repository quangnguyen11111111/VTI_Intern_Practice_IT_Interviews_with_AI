import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { GeneratePayload, SubmitPayload } from '../types';

export class GeneratingState implements IInterviewState {
  getName(): InterviewStatus {
    return 'GENERATING';
  }

  async generate(context: InterviewContext, payload: GeneratePayload): Promise<void> {
    // Đang sinh câu hỏi rồi, không được gọi lại -> Idempotency
    throw new InvalidStateTransitionException('Interview is already in GENERATING state. Please wait.');
  }

  async submit(context: InterviewContext, payload: SubmitPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot submit answers while questions are being generated.');
  }

  async saveProgress(context: InterviewContext, payload: import('../types').SaveProgressPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot save progress while questions are being generated.');
  }
}
