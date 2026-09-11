import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  interviewApi,
  type InterviewHistoryResult,
  type InterviewHistoryStatus,
} from '../../services/api/interviewApi';
import type { HistoryFilters, HistorySort } from './types';

const DEFAULT_FILTERS: HistoryFilters = {
  page: 1,
  limit: 10,
  role: '',
  level: '',
  technology: '',
  status: '',
  from: '',
  to: '',
  sort: 'newest',
};

const statuses: InterviewHistoryStatus[] = [
  'PENDING',
  'GENERATING',
  'IN_PROGRESS',
  'EVALUATING',
  'COMPLETED',
  'FAILED',
];

const parsePositiveInt = (
  value: string | null,
  fallback: number,
  max?: number,
) => {
  if (!value) return fallback;

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  if (max !== undefined && parsed > max) {
    return fallback;
  }

  return parsed;
};

const readFilters = (params: URLSearchParams): HistoryFilters => {
  const status = params.get('status');
  const sort = params.get('sort');

  return {
    page: parsePositiveInt(params.get('page'), DEFAULT_FILTERS.page),
    limit: parsePositiveInt(params.get('limit'), DEFAULT_FILTERS.limit, 100),
    role: params.get('role') ?? DEFAULT_FILTERS.role,
    level: params.get('level') ?? DEFAULT_FILTERS.level,
    technology: params.get('technology') ?? DEFAULT_FILTERS.technology,
    status:
      status && statuses.includes(status as InterviewHistoryStatus)
        ? (status as InterviewHistoryStatus)
        : '',
    from: params.get('from') ?? DEFAULT_FILTERS.from,
    to: params.get('to') ?? DEFAULT_FILTERS.to,
    sort: sort === 'oldest' ? 'oldest' : 'newest',
  };
};

const writeFilters = (filters: HistoryFilters) => {
  const params = new URLSearchParams();

  if (filters.page !== 1) {
    params.set('page', String(filters.page));
  }

  if (filters.limit !== 10) {
    params.set('limit', String(filters.limit));
  }

  if (filters.role) {
    params.set('role', filters.role);
  }

  if (filters.level) {
    params.set('level', filters.level);
  }

  if (filters.technology) {
    params.set('technology', filters.technology);
  }

  if (filters.status) {
    params.set('status', filters.status);
  }

  if (filters.from) {
    params.set('from', filters.from);
  }

  if (filters.to) {
    params.set('to', filters.to);
  }

  if (filters.sort !== 'newest') {
    params.set('sort', filters.sort);
  }

  return params;
};

const filtersKey = (filters: HistoryFilters) => JSON.stringify(filters);

export const useInterviewHistory = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(
    () => readFilters(searchParams),
    [searchParams],
  );

  const requestKey = useMemo(() => filtersKey(filters), [filters]);

  const [result, setResult] = useState<InterviewHistoryResult | null>(null);
  const [loadingKey, setLoadingKey] = useState(() => requestKey);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const isLoading = loadingKey === requestKey;

  const updateFilters = useCallback(
    (patch: Partial<HistoryFilters>) => {
      const next = { ...filters, ...patch };

      if (Object.keys(patch).some((key) => key !== 'page')) {
        next.page = 1;
      }

      setLoadingKey(filtersKey(next));
      setError(null);
      setSearchParams(writeFilters(next));
    },
    [filters, setSearchParams],
  );

  const retry = useCallback(() => {
    setLoadingKey(requestKey);
    setError(null);
    setRetryKey((value) => value + 1);
  }, [requestKey]);

  useEffect(() => {
    let cancelled = false;

    interviewApi
      .fetchInterviewHistory({
        ...filters,
        status: filters.status || undefined,
      })
      .then((data) => {
        if (cancelled) return;

        setResult(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        setResult(null);
        setError(
          err instanceof Error
            ? err.message
            : 'Không thể tải lịch sử phỏng vấn.',
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingKey('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [filters, retryKey]);

  return {
    filters,
    result,
    isLoading,
    error,
    updateFilters,
    retry,
  };
};

export const historyDefaults = DEFAULT_FILTERS;

export const historySortOptions: Array<{
  value: HistorySort;
  label: string;
}> = [
  { value: 'newest', label: 'Mới nhất trước' },
  { value: 'oldest', label: 'Cũ nhất trước' },
];