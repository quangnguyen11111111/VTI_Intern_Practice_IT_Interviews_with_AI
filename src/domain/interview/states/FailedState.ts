import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';
import { PendingState } from './PendingState';
import { InProgressState } from './InProgressState';
import { GeneratePayload, SubmitPayload, SaveProgressPayload } from '../types';
import { InvalidStateTransitionException } from '../exceptions/InvalidStateTransitionException';
import { logger } from '../../../infrastructure/logging/logger';

export class FailedState implements IInterviewState {
  getName(): InterviewStatus {
    return 'FAILED';
  }

  async generate(context: InterviewContext, payload: GeneratePayload): Promise<void> {
    logger.info('interview.retry_generation', { resourceType: 'interview', resourceId: context.getInterviewId() });
    const pendingState = new PendingState();
    await pendingState.generate(context, payload);
  }

  async submit(context: InterviewContext, payload: SubmitPayload): Promise<void> {
    logger.info('interview.retry_submission', { resourceType: 'interview', resourceId: context.getInterviewId() });
    const inProgressState = new InProgressState();
    await inProgressState.submit(context, payload);
  }

  async saveProgress(context: InterviewContext, payload: SaveProgressPayload): Promise<void> {
    throw new InvalidStateTransitionException('Cannot save progress for a FAILED interview.');
  }
}
