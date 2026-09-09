import { useState, useCallback } from 'react';
import { adminSystemPromptApi } from '../../../services/api/adminSystemPromptApi';
import type { SystemPrompt, GetSystemPromptsParams } from '../types';

export const useSystemPrompts = () => {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrompts = useCallback(async (params?: GetSystemPromptsParams) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminSystemPromptApi.getPrompts(params);
      setPrompts(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prompts');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    prompts,
    loading,
    error,
    fetchPrompts
  };
};
