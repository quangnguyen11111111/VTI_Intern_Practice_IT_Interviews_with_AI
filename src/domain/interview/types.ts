export interface InterviewSetupPayload {
  jobPosition: string;
  level: string;
  techStacks: string[];
}

export interface LocalizedContent {
  en: string;
  vi: string;
}

export interface InterviewQuestionPayload {
  order: number;
  difficulty: string;
  content: LocalizedContent;
}

export interface AnswerPayload {
  questionId: string;
  candidateAnswer: string;
}

export interface GeneratedQuestion {
  order: number;
  difficulty: string;
  content: LocalizedContent;
}

export interface EvaluatedAnswer {
  questionId: string;
  feedback: LocalizedContent;
  score: number;
}

export interface EvaluationResult {
  evaluations: EvaluatedAnswer[];
  overallScore: number;
  learningPath: { topic: string; priority: string; suggestion: string }[];
}

export interface IAiProvider {
  generateQuestions(setupData: InterviewSetupPayload): Promise<GeneratedQuestion[]>;
  evaluateAnswers(questions: any[], answers: AnswerPayload[]): Promise<EvaluationResult>;
}

export interface GeneratePayload {
  setupData: InterviewSetupPayload;
  aiProvider?: IAiProvider; // Optional because we might inject it in service now
}

export interface SubmitPayload {
  data: AnswerPayload[];
  aiProvider?: IAiProvider;
}
