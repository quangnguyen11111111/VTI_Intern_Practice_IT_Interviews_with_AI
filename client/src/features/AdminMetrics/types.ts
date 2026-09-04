export interface AdminMetricsDateRange {
  from: string;
  to: string;
}

export interface AdminUserMetrics {
  total: number;
  active: number;
  locked: number;
  inactive: number;
}

export interface AdminInterviewMetrics {
  total: number;
  byStatus: {
    PENDING: number;
    GENERATING: number;
    IN_PROGRESS: number;
    EVALUATING: number;
    COMPLETED: number;
    FAILED: number;
  };
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface AdminMetricsData {
  users: AdminUserMetrics;
  interviews: AdminInterviewMetrics;
}