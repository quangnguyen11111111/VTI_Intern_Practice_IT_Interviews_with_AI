export interface InterviewAnalyticsQuery {
  role?: string;
  level?: string;
  technology?: string;
  /** Inclusive UTC boundary. */
  from?: Date;
  /** Exclusive UTC boundary. */
  to?: Date;
}

export interface InterviewAnalyticsDimension {
  name: string;
  score: number | null;
}

export interface InterviewAnalyticsSeriesPoint {
  date: string;
  overallScore: number;
  dimensions: InterviewAnalyticsDimension[];
}

export interface InterviewAnalyticsSummary {
  totalCompleted: number;
  averageOverallScore: number | null;
  dimensions: InterviewAnalyticsDimension[];
}

export interface InterviewAnalyticsResult {
  summary: InterviewAnalyticsSummary;
  series: InterviewAnalyticsSeriesPoint[];
}

export interface IInterviewAnalyticsRepository {
  getAnalytics(
    userId: string,
    query: InterviewAnalyticsQuery
  ): Promise<InterviewAnalyticsResult>;
}
