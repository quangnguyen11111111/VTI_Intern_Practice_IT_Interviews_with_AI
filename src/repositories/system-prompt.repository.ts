import { injectable } from 'tsyringe';

import {
  ISystemPrompt,
  SystemPromptLanguage,
  SystemPromptType,
  SystemPromptModel
} from '../models/system-prompt.model';

import {
  CreateSystemPromptInput,
  ISystemPromptRepository
} from './interfaces/ISystemPromptRepository';

@injectable()
export class SystemPromptRepository
  implements ISystemPromptRepository
{
  async createDraft(
    input: CreateSystemPromptInput,
    version: number
  ): Promise<ISystemPrompt> {
    return SystemPromptModel.create({
      promptKey: input.promptKey,
      type: input.type,
      language: input.language,
      version,
      content: input.content,
      status: 'DRAFT',
      createdBy: input.createdBy,
      publishedAt: null
    });
  }

  async findById(
    id: string
  ): Promise<ISystemPrompt | null> {
    return SystemPromptModel.findById(id);
  }

  async findVersions(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<ISystemPrompt[]> {
    return SystemPromptModel.find({
      promptKey,
      type,
      language
    }).sort({ version: -1 });
  }

  async findPublished(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<ISystemPrompt | null> {
    return SystemPromptModel.findOne({
      promptKey,
      type,
      language,
      status: 'PUBLISHED'
    });
  }

  async archiveCurrentPublished(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<void> {
    await SystemPromptModel.updateMany(
      {
        promptKey,
        type,
        language,
        status: 'PUBLISHED'
      },
      {
        $set: {
          status: 'ARCHIVED'
        }
      }
    );
  }

  async publish(
    id: string
  ): Promise<ISystemPrompt | null> {
    return SystemPromptModel.findOneAndUpdate(
      {
        _id: id,
        status: 'DRAFT'
      },
      {
        $set: {
          status: 'PUBLISHED',
          publishedAt: new Date()
        }
      },
      {
        new: true
      }
    );
  }

  async getNextVersion(
    promptKey: string,
    type: SystemPromptType,
    language: SystemPromptLanguage
  ): Promise<number> {
    const latest =
      await SystemPromptModel.findOne({
        promptKey,
        type,
        language
      }).sort({ version: -1 });

    return latest
      ? latest.version + 1
      : 1;
  }
}