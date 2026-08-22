import { IInterviewState, InterviewStatus } from '../IInterviewState';
import { InterviewContext } from '../InterviewContext';
import { PendingState } from './PendingState';
import { InProgressState } from './InProgressState';
import { GeneratePayload, SubmitPayload } from '../types';

export class FailedState implements IInterviewState {
  getName(): InterviewStatus {
    return 'FAILED';
  }

  async generate(context: InterviewContext, payload: GeneratePayload): Promise<void> {
    console.log(`[FailedState] Retrying generation for interview: ${context.getInterviewId()}`);
    // Giả sử FAILED do lỗi generate, ta có thể Retry bằng cách quay lại logic sinh đề
    // Delegate lại cho PendingState để trigger quá trình chuyển sang GENERATING
    const pendingState = new PendingState();
    await pendingState.generate(context, payload);
  }

  async submit(context: InterviewContext, payload: SubmitPayload): Promise<void> {
    console.log(`[FailedState] Retrying submission for interview: ${context.getInterviewId()}`);
    // Giả sử FAILED do lỗi evaluate, ta có thể Retry nộp lại
    const inProgressState = new InProgressState();
    await inProgressState.submit(context, payload);
  }
}
