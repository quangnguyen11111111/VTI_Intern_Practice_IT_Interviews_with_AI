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
    const data = await request<{ data: SystemPrompt[] }>(
      `admin/prompts${buildQuery(params)}`
    );
    return data.data; // Assuming backend returns { data: SystemPrompt[] }
  },

  getPromptById: async (id: string): Promise<SystemPrompt> => {
    const data = await request<{ data: SystemPrompt }>(`admin/prompts/${id}`);
    return data.data;
  },

  createDraft: async (payload: CreateSystemPromptDto): Promise<SystemPrompt> => {
    const data = await request<{ data: SystemPrompt }>('admin/prompts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return data.data;
  },

  publishPrompt: async (id: string): Promise<SystemPrompt> => {
    const data = await request<{ data: SystemPrompt }>(`admin/prompts/${id}/publish`, {
      method: 'POST',
    });
    return data.data;
  },

  rollbackPrompt: async (id: string): Promise<SystemPrompt> => {
    const data = await request<{ data: SystemPrompt }>(`admin/prompts/${id}/rollback`, {
      method: 'POST',
    });
    return data.data;
  },
};
