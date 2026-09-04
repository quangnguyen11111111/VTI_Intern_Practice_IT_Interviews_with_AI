import {
  InterviewSetupPayload,
  LocalizedContent
} from '../domain/interview/types';

import {
  InterviewStatus
} from '../domain/interview/IInterviewState';

export interface InterviewPromptVersion {
  promptId: string;
  version: number;
  language: 'EN' | 'VI';
}

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
  learningPath?:
    | {
        topic: string;
        priority: string;
        suggestion: string;
      }[]
    | null;

  promptVersions?: {
    generation?: InterviewPromptVersion;
    evaluation?: InterviewPromptVersion;
    learningPath?: InterviewPromptVersion;
  };

  metadata?: import('../domain/interview/types').AiUsageMetadata;

  createdAt: Date;
  updatedAt: Date;
}

export interface IInterviewRepository {
  create(
    data: InterviewSetupPayload,
    userId?: string
  ): Promise<InterviewEntity>;

  findById(
    id: string
  ): Promise<InterviewEntity | null>;

  updateStatus(
    id: string,
    status: InterviewStatus
  ): Promise<void>;

  update(
    id: string,
    data: Partial<InterviewEntity>
  ): Promise<void>;

  updateTokenUsage(
    id: string,
    usage: import('../domain/interview/types').AiUsageMetadata
  ): Promise<void>;

  updatePromptVersion(
    id: string,
    type:
      | 'generation'
      | 'evaluation'
      | 'learningPath',
    promptVersion: InterviewPromptVersion
  ): Promise<void>;

  // Question management
  createQuestions(
    sessionId: string,
    questions: Omit<
      InterviewQuestionEntity,
      | 'id'
      | 'sessionId'
      | 'createdAt'
      | 'updatedAt'
      | 'candidateAnswer'
      | 'feedback'
      | 'score'
    >[]
  ): Promise<InterviewQuestionEntity[]>;

  updateQuestionAnswer(
    questionId: string,
    answer: string
  ): Promise<void>;

  updateQuestionFeedback(
    questionId: string,
    feedback: LocalizedContent,
    score: number
  ): Promise<void>;
}