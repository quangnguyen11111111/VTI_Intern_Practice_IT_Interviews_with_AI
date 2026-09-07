export interface LocalizedContent {
  en: string;
  vi: string;
}

export interface Question {
  id?: string;
  _id?: string;
  order: number;
  difficulty: string;
  category?: string;
  content: LocalizedContent;
  candidateAnswer?: string;
  feedback?: LocalizedContent;
  score?: number;
}

export interface AnswerState {
  questionId: string;
  candidateAnswer: string;
}

export interface InterviewSession {
  id?: string;
  _id?: string;
  status: string;
  createdAt?: string | Date;
  setupData: {
    jobPosition?: string;
    level?: string;
    techStacks?: string[];
  };
  questions?: Question[];
  dimensions?: { name: string; score: number; reasoning: string }[];
  overallScore?: number;
  learningPath?: { 
    topic: LocalizedContent; 
    priority: string; 
    suggestion: LocalizedContent 
  }[];
}
