import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { GeneratePayload, SubmitPayload } from '../types';

export class CompletedState implements IInterviewState {
  getName(): InterviewStatus {
    return 'COMPLETED';
  }

  async generate(context: InterviewContext, payload: GeneratePayload): Promise<void> {
    throw new InvalidStateTransitionException('Interview is already COMPLETED. Cannot generate questions.');
  }

  async submit(context: InterviewContext, payload: SubmitPayload): Promise<void> {
    throw new InvalidStateTransitionException('Interview is already COMPLETED. Cannot submit answers again.');
  }
}
