export interface LocalizedContent {
  en: string;
  vi: string;
}

export interface Question {
  _id: string;
  order: number;
  difficulty: string;
  category?: string;
  content: LocalizedContent;
}

export interface AnswerState {
  questionId: string;
  candidateAnswer: string;
}

export interface InterviewSession {
  _id: string;
  status: string;
  setupData: {
    jobPosition?: string;
    level?: string;
    techStacks?: string[];
  };
  questions?: Question[];
}
