import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload, LocalizedContent } from '../domain/interview/types';

export interface InterviewQuestionEntity {
  id: string;
  sessionId: string;
  order: number;
  difficulty: string;
  content: LocalizedContent;
  candidateAnswer: string | null;
  feedback: LocalizedContent | null;
  score: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewEntity {
  id: string;
  userId?: string;
  status: InterviewStatus;
  setupData: InterviewSetupPayload;
  questions?: InterviewQuestionEntity[];
  overallScore?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IInterviewRepository {
  create(data: InterviewSetupPayload, userId?: string): Promise<InterviewEntity>;
  findById(id: string): Promise<InterviewEntity | null>;
  updateStatus(id: string, status: InterviewStatus): Promise<void>;
  update(id: string, data: Partial<InterviewEntity>): Promise<void>;
  
  // Question management
  createQuestions(sessionId: string, questions: Omit<InterviewQuestionEntity, 'id' | 'sessionId' | 'createdAt' | 'updatedAt' | 'candidateAnswer' | 'feedback' | 'score'>[]): Promise<InterviewQuestionEntity[]>;
  updateQuestionAnswer(questionId: string, answer: string): Promise<void>;
  updateQuestionFeedback(questionId: string, feedback: LocalizedContent, score: number): Promise<void>;
}
