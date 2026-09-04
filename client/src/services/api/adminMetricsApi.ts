import type {
  AdminMetricsData,
  AdminMetricsDateRange
} from '../../features/AdminMetrics/types';

import { request } from '../../auth/apiClient';

const buildQuery = (
  range: AdminMetricsDateRange
): string => {
  const searchParams = new URLSearchParams();

  searchParams.set('from', range.from);
  searchParams.set('to', range.to);

  return `?${searchParams.toString()}`;
};

export const adminMetricsApi = {
  getMetrics: async (
    range: AdminMetricsDateRange
  ): Promise<AdminMetricsData> => {
    return request<AdminMetricsData>(
      `admin/metrics${buildQuery(range)}`
    );
  }
};