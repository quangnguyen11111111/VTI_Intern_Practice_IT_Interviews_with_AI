export interface InterviewSetupPayload {
  jobPosition: string;
  level: string;
  techStacks: string[];
}

export interface IAiService {
  generateQuestions(interviewId: string, setupData: InterviewSetupPayload): Promise<void>;
  evaluateAnswers(interviewId: string, answers: unknown[]): Promise<void>;
}

export interface GeneratePayload {
  setupData: InterviewSetupPayload;
  aiService: IAiService;
}

export interface SubmitPayload {
  data: unknown[];
  aiService: IAiService;
}
