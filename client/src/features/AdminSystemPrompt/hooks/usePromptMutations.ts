import { useState } from 'react';
import { adminSystemPromptApi } from '../../../services/api/adminSystemPromptApi';
import type { CreateSystemPromptDto, SystemPrompt } from '../types';

export const usePromptMutations = () => {
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const createDraft = async (payload: CreateSystemPromptDto): Promise<SystemPrompt | null> => {
    setIsMutating(true);
    setError(null);
    try {
      const result = await adminSystemPromptApi.createDraft(payload);
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create draft');
      return null;
    } finally {
      setIsMutating(false);
    }
  };

  const publishPrompt = async (id: string): Promise<SystemPrompt | null> => {
    setIsMutating(true);
    setError(null);
    try {
      const result = await adminSystemPromptApi.publishPrompt(id);
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to publish prompt');
      return null;
    } finally {
      setIsMutating(false);
    }
  };

  const rollbackPrompt = async (id: string): Promise<SystemPrompt | null> => {
    setIsMutating(true);
    setError(null);
    try {
      const result = await adminSystemPromptApi.rollbackPrompt(id);
      return result;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to rollback prompt');
      return null;
    } finally {
      setIsMutating(false);
    }
  };

  return {
    isMutating,
    error,
    createDraft,
    publishPrompt,
    rollbackPrompt
  };
};
