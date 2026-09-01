import { IInterviewState, InterviewStatus } from './IInterviewState';

import { PendingState } from './states/PendingState';


import { GeneratePayload, SubmitPayload } from './types';
import { GeneratingState } from './states/GeneratingState';
import { InProgressState } from './states/InProgressState';
import { EvaluatingState } from './states/EvaluatingState';
import { CompletedState } from './states/CompletedState';
import { FailedState } from './states/FailedState';
import { IInterviewRepository } from '../../repositories/IInterviewRepository';

export class InterviewContext {
  private state: IInterviewState;
  private interviewId: string;
  private repository: IInterviewRepository;

  constructor(interviewId: string, repository: IInterviewRepository, initialState?: IInterviewState) {
    this.interviewId = interviewId;
    this.repository = repository;
    // Default state is PENDING if not provided
    this.state = initialState || new PendingState();
  }

  public getInterviewId(): string {
    return this.interviewId;
  }

  public getState(): IInterviewState {
    return this.state;
  }

  public getRepository(): IInterviewRepository {
    return this.repository;
  }

  /**
   * Chuyển đổi trạng thái và cập nhật xuống DB (có thể gọi hàm update trạng thái ở đây)
   */
  public async changeState(newState: IInterviewState): Promise<void> {
    this.state = newState;
    // Update state to persistent storage
    await this.repository.updateStatus(this.interviewId, this.state.getName());
  }

  /**
   * Delegate action 'generate' to current state
   */
  public async generate(payload: GeneratePayload): Promise<void> {
    await this.state.generate(this, payload);
  }

  /**
   * Delegate action 'submit' to current state
   */
  public async submit(payload: SubmitPayload): Promise<void> {
    await this.state.submit(this, payload);
  }

  /**
   * Delegate action 'saveProgress' to current state
   */
  public async saveProgress(payload: import('./types').SaveProgressPayload): Promise<void> {
    await this.state.saveProgress(this, payload);
  }

  /**
   * Static factory method to instantiate correct state based on status string from DB
   */
  public static createStateFromStatus(status: InterviewStatus): IInterviewState {
    switch (status) {
      case 'PENDING': return new PendingState();
      case 'GENERATING': return new GeneratingState();
      case 'IN_PROGRESS': return new InProgressState();
      case 'EVALUATING': return new EvaluatingState();
      case 'COMPLETED': return new CompletedState();
      case 'FAILED': return new FailedState();
      default: return new PendingState();
    }
  }
}
