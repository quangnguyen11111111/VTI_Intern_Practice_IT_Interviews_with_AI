const API_URL = 'http://localhost:3000/api/v1';

export interface BaseEntity {
  _id: string;
  code: string;
  name: string;
}

export interface InterviewSetupPayload {
  jobPosition: string; // role ID
  level: string; // level ID
  techStacks: string[]; // array of technology IDs
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractArrayData = (json: any, key: string): BaseEntity[] => {
  if (Array.isArray(json)) return json;
  if (json?.data) {
    if (Array.isArray(json.data)) return json.data;
    if (json.data[key] && Array.isArray(json.data[key])) return json.data[key];
    if (json.data.items && Array.isArray(json.data.items)) return json.data.items;
  }
  return [];
};

export const interviewApi = {
  /**
   * Fetch all Roles (Job Positions)
   */
  fetchRoles: async (): Promise<BaseEntity[]> => {
    try {
      const response = await fetch(`${API_URL}/roles?limit=1000`);
      const json = await response.json();
      return extractArrayData(json, 'roles');
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      return [];
    }
  },

  /**
   * Fetch all Levels
   */
  fetchLevels: async (): Promise<BaseEntity[]> => {
    try {
      const response = await fetch(`${API_URL}/levels?limit=1000`);
      const json = await response.json();
      return extractArrayData(json, 'levels');
    } catch (error) {
      console.error('Failed to fetch levels:', error);
      return [];
    }
  },

  /**
   * Fetch all Technologies, optionally filtered by role
   */
  fetchTechnologies: async (roleId?: string): Promise<BaseEntity[]> => {
    try {
      const url = roleId 
        ? `${API_URL}/technologies?limit=1000&roleId=${roleId}` 
        : `${API_URL}/technologies?limit=1000`;
      const response = await fetch(url);
      const json = await response.json();
      return extractArrayData(json, 'technologies');
    } catch (error) {
      console.error('Failed to fetch technologies:', error);
      return [];
    }
  },

  /**
   * Submit interview setup configuration
   */
  setupInterview: async (payload: InterviewSetupPayload): Promise<void> => {
    return new Promise((resolve) => {
      console.log('Sending API Request with payload:', payload);
      setTimeout(() => {
        resolve();
      }, 1000);
    });
  },
};
