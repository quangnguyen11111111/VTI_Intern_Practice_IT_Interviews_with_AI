import { InterviewStatus } from '../../domain/interview/IInterviewState';

export interface InterviewHistoryQuery {
  page: number;
  limit: number;
  role?: string;
  level?: string;
  technology?: string;
  status?: InterviewStatus;
  /** Inclusive UTC boundary. */
  from?: Date;
  /** Exclusive UTC boundary. */
  to?: Date;
  sort: 'newest' | 'oldest';
}

export interface InterviewHistoryItem {
  sessionId: string;
  /** Interview Role / Job Position identifier. */
  role?: string;
  /** Interview Level identifier. */
  level?: string;
  /** Technology identifiers. */
  technologies: string[];
  score: number | null;
  status: InterviewStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewHistoryResult {
  items: InterviewHistoryItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface IInterviewHistoryRepository {
  findHistory(
    userId: string,
    query: InterviewHistoryQuery
  ): Promise<InterviewHistoryResult>;
}
