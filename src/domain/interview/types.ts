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

export interface IAiService {
  generateQuestions(interviewId: string, setupData: InterviewSetupPayload): Promise<void>;
  evaluateAnswers(interviewId: string, answers: AnswerPayload[]): Promise<void>;
}

export interface GeneratePayload {
  setupData: InterviewSetupPayload;
  aiService: IAiService;
}

export interface SubmitPayload {
  data: AnswerPayload[];
  aiService: IAiService;
}
