



import { InterviewContext } from './InterviewContext';
import { GeneratePayload, SubmitPayload } from './types';

export type InterviewStatus = 
  | 'PENDING'
  | 'GENERATING'
  | 'IN_PROGRESS'
  | 'EVALUATING'
  | 'COMPLETED'
  | 'FAILED';

export interface IInterviewState {
  getName(): InterviewStatus;
  
  /**
   * Action to trigger AI generation of questions
   */
  generate(context: InterviewContext, payload: GeneratePayload): Promise<void>;
  
  /**
   * Action to submit answers and trigger evaluation
   */
  submit(context: InterviewContext, payload: SubmitPayload): Promise<void>;
}
