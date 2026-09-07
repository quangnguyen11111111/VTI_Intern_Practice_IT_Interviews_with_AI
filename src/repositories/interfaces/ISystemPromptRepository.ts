import {
  ISystemPrompt,
  SystemPromptLanguage,
  SystemPromptType
} from '../../models/system-prompt.model';

export interface CreateSystemPromptInput {
  promptKey: string;
  type: SystemPromptType;
  language: SystemPromptLanguage;
  content: string;
  createdBy: string;
}

export interface ISystemPromptRepository {
  createDraft(
    input: CreateSystemPromptInput,
    version: number
  ): Promise<ISystemPrompt>;

  findById(
    id: string
  ): Promise<ISystemPrompt | null>;

  findVersions(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<ISystemPrompt[]>;

  findPublished(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<ISystemPrompt | null>;

  archiveCurrentPublished(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<void>;

  publish(
    id: string
  ): Promise<ISystemPrompt | null>;

  getNextVersion(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<number>;
}