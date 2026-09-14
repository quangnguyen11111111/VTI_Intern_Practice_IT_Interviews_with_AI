import type {
  BaseEntity,
  InterviewAnalyticsResult
} from '../../services/api/interviewApi';

export interface AnalyticsFilters {
  role?: string;
  level?: string;
  technology?: string;
  from?: string;
  to?: string;
}

export interface AnalyticsCatalogs {
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
}

export type { InterviewAnalyticsResult };
