export interface InterviewSetupPayload {
  jobPosition?: string;
  level?: string;
  techStacks?: string[];
  jdText?: string;
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
  category?: string;
  content: LocalizedContent;
}

export interface EvaluatedAnswer {
  questionId: string;
  feedback: LocalizedContent;
  score: number;
}

export interface EvaluationDimension {
  name: string;
  score: number;
  reasoning: string;
}

export interface EvaluationResult {
  evaluations: EvaluatedAnswer[];
  overallScore: number;
  dimensions: EvaluationDimension[];
  learningPath: { 
    topic: LocalizedContent; 
    priority: string; 
    suggestion: LocalizedContent 
  }[];
}

export interface AiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface IAiProvider {
  generateQuestions(setupData: InterviewSetupPayload): Promise<{ data: GeneratedQuestion[], audit: AiUsageMetadata }>;
  evaluateAnswers(questions: any[], answers: AnswerPayload[]): Promise<{ data: EvaluationResult, audit: AiUsageMetadata }>;
}

export interface GeneratePayload {
  setupData: InterviewSetupPayload;
  aiProvider?: IAiProvider; // Optional because we might inject it in service now
  jobScheduler?: import('../jobs/IJobScheduler').IJobScheduler;
}

export interface SubmitPayload {
  data: AnswerPayload[];
  aiProvider?: IAiProvider;
  jobScheduler?: import('../jobs/IJobScheduler').IJobScheduler;
}

export interface SaveProgressPayload {
  answers: AnswerPayload[];
}
