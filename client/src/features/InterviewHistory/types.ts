import type {
  BaseEntity,
  InterviewHistoryItem,
  InterviewHistoryStatus,
} from '../../services/api/interviewApi';

export type HistorySort = 'newest' | 'oldest';

export interface HistoryFilters {
  page: number;
  limit: number;
  role: string;
  level: string;
  technology: string;
  status: InterviewHistoryStatus | '';
  from: string;
  to: string;
  sort: HistorySort;
}

export interface HistoryCatalogs {
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
}

export interface HistoryDisplayMaps {
  roles: Map<string, string>;
  levels: Map<string, string>;
  technologies: Map<string, string>;
}

export type { InterviewHistoryItem, InterviewHistoryStatus };
