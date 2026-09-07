import {
  ISystemPrompt,
  SystemPromptLanguage,
  SystemPromptType
} from '../../models/system-prompt.model';

export interface CreatePromptInput {
  promptKey: string;
  type: SystemPromptType;
  language: SystemPromptLanguage;
  content: string;
  actorId: string;
}

export interface ISystemPromptService {
  createDraft(
    input: CreatePromptInput
  ): Promise<ISystemPrompt>;

  getPrompt(
    id: string
  ): Promise<ISystemPrompt>;

  listVersions(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<ISystemPrompt[]>;

  publish(
    id: string,
    actorId: string
  ): Promise<ISystemPrompt>;

  rollback(
    id: string,
    actorId: string
  ): Promise<ISystemPrompt>;

  getPublished(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<ISystemPrompt>;
}