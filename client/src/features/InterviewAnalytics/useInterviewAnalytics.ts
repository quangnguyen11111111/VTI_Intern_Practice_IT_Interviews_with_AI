import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  interviewApi,
  type InterviewAnalyticsQuery
} from '../../services/api/interviewApi';
import type { AnalyticsFilters } from './types';

const readFilters = (params: URLSearchParams): AnalyticsFilters => ({
  role: params.get('role') || undefined,
  level: params.get('level') || undefined,
  technology: params.get('technology') || undefined,
  from: params.get('from') || undefined,
  to: params.get('to') || undefined,
});

export const useInterviewAnalytics = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<
    import('../../services/api/interviewApi').InterviewAnalyticsResult | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => readFilters(searchParams),
    [searchParams]
  );

  const query = useMemo<InterviewAnalyticsQuery>(
    () => filters,
    [filters]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await interviewApi.getAnalytics(query);
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải dữ liệu phân tích.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
  // Async API loading intentionally updates local state from the effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  void load();
}, [load]);

  const updateFilters = useCallback(
    (next: Partial<AnalyticsFilters>) => {
      const params = new URLSearchParams(searchParams);

      Object.entries(next).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  return {
    filters,
    data,
    isLoading,
    error,
    updateFilters,
    retry: load
  };
};

