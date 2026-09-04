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

export interface LearningPathItem {
  topic: string;
  priority: string;
  suggestion: string;
}

export interface EvaluationResult {
  evaluations: EvaluatedAnswer[];
  overallScore: number;
  learningPath: LearningPathItem[];
}

export interface LearningPathResult {
  learningPath: LearningPathItem[];
}

export interface AiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface SystemPromptContext {
  content: string;
  promptId: string;
  version: number;
  language: 'EN' | 'VI';
}

export interface IAiProvider {
  generateQuestions(
    setupData: InterviewSetupPayload,
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: GeneratedQuestion[];
    audit: AiUsageMetadata;
  }>;

  evaluateAnswers(
    questions: any[],
    answers: AnswerPayload[],
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: EvaluationResult;
    audit: AiUsageMetadata;
  }>;

  generateLearningPath(
    questions: any[],
    answers: AnswerPayload[],
    evaluation: EvaluationResult,
    systemPrompt?: SystemPromptContext
  ): Promise<{
    data: LearningPathResult;
    audit: AiUsageMetadata;
  }>;
}

export interface GeneratePayload {
  setupData: InterviewSetupPayload;

  aiProvider?: IAiProvider;

  systemPrompt?: SystemPromptContext;

  jobScheduler?: import('../jobs/IJobScheduler').IJobScheduler;
}

export interface SubmitPayload {
  data: AnswerPayload[];

  aiProvider?: IAiProvider;

  systemPrompt?: SystemPromptContext;

  learningPathPrompt?: SystemPromptContext;

  jobScheduler?: import('../jobs/IJobScheduler').IJobScheduler;
}

export interface SaveProgressPayload {
  answers: AnswerPayload[];
}