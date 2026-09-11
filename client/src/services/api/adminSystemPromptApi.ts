import { request } from '../../auth/apiClient';
import type {
  SystemPrompt,
  GetSystemPromptsParams,
  CreateSystemPromptDto
} from '../../features/AdminSystemPrompt/types';

const buildQuery = (params: GetSystemPromptsParams): string => {
  const searchParams = new URLSearchParams();

  if (params.type) {
    searchParams.set('type', params.type);
  }
  if (params.language) {
    searchParams.set('language', params.language);
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export const adminSystemPromptApi = {
  getPrompts: async (params: GetSystemPromptsParams = {}): Promise<SystemPrompt[]> => {
    // According to backend route: GET /api/admin/prompts
    const data = await request<SystemPrompt[]>(
      `admin/prompts${buildQuery(params)}`
    );
    return data;
  },

  getPromptById: async (id: string): Promise<SystemPrompt> => {
    const data = await request<SystemPrompt>(`admin/prompts/${id}`);
    return data;
  },

  createDraft: async (payload: CreateSystemPromptDto): Promise<SystemPrompt> => {
    const data = await request<SystemPrompt>('admin/prompts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data;
  },

  publishPrompt: async (id: string): Promise<SystemPrompt> => {
    const data = await request<SystemPrompt>(`admin/prompts/${id}/publish`, {
      method: 'POST',
    });
    return data;
  },

  rollbackPrompt: async (id: string): Promise<SystemPrompt> => {
    const data = await request<SystemPrompt>(`admin/prompts/${id}/rollback`, {
      method: 'POST',
    });
    return data;
  },
};
