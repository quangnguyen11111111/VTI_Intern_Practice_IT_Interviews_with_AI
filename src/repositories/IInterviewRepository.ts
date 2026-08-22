import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload } from '../domain/interview/types';

export interface InterviewEntity {
  id: string;
  status: InterviewStatus;
  setupData?: InterviewSetupPayload;
  questions?: unknown[];
  answers?: unknown[];
  score?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInterviewRepository {
  create(data: InterviewSetupPayload): Promise<InterviewEntity>;
  findById(id: string): Promise<InterviewEntity | null>;
  updateStatus(id: string, status: InterviewStatus): Promise<void>;
  update(id: string, data: Partial<InterviewEntity>): Promise<void>;
}
