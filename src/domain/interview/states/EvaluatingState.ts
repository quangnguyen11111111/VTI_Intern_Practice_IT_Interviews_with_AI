import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { GeneratePayload, SubmitPayload } from '../types';

export class EvaluatingState implements IInterviewState {
  getName(): InterviewStatus {
    return 'EVALUATING';
  }

  async generate(context: InterviewContext, payload: GeneratePayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot generate questions while EVALUATING answers.');
  }

  async submit(context: InterviewContext, payload: SubmitPayload): Promise<void> {
    throw new InvalidStateTransitionException('Interview is already in EVALUATING state. Answers were already submitted.');
  }

  async saveProgress(context: InterviewContext, payload: import('../types').SaveProgressPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot save progress while EVALUATING.');
  }
}
