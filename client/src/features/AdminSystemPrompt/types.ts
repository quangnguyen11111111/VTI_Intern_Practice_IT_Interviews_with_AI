export type PromptType = 'GENERATION' | 'EVALUATION' | 'LEARNING_PATH';
export type PromptLanguage = 'EN' | 'VI';
export type PromptStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface SystemPrompt {
  _id: string;
  promptKey: string;
  type: PromptType;
  language: PromptLanguage;
  version: number;
  content: string;
  status: PromptStatus;
  createdBy: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetSystemPromptsParams {
  type?: PromptType;
  language?: PromptLanguage;
  status?: PromptStatus;
}

export interface CreateSystemPromptDto {
  promptKey: string;
  type: PromptType;
  language: PromptLanguage;
  content: string;
}
