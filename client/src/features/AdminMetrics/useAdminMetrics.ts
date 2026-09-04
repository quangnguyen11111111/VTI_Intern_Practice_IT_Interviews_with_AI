import { useEffect, useState } from 'react';

import { adminMetricsApi } from '../../services/api/adminMetricsApi';

import type {
  AdminMetricsData,
  AdminMetricsDateRange
} from './types';

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');
  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getDefaultDateRange = (): AdminMetricsDateRange => {
  const now = new Date();

  const firstDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  const firstDayNextMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1
  );

  return {
    from: `${formatDate(firstDay)}T00:00:00.000Z`,
    to: `${formatDate(firstDayNextMonth)}T00:00:00.000Z`
  };
};

export const useAdminMetrics = () => {
  const [dateRange, setDateRange] =
    useState<AdminMetricsDateRange>(
      getDefaultDateRange()
    );

  const [metrics, setMetrics] =
    useState<AdminMetricsData | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const loadMetrics = async (
    range: AdminMetricsDateRange
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const response =
        await adminMetricsApi.getMetrics(range);

      setMetrics(response);
    } catch (err) {
      console.error(
        'Failed to fetch admin metrics:',
        err
      );

      setError(
        'Không thể tải system metrics. Vui lòng thử lại.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      await loadMetrics(dateRange);
    };

    void load();
  }, [dateRange]);

  const handleDateRangeChange = (
    range: AdminMetricsDateRange
  ) => {
    setDateRange(range);
  };

  const handleReload = () => {
    void loadMetrics(dateRange);
  };

  return {
    dateRange,
    metrics,
    isLoading,
    error,

    handleDateRangeChange,
    handleReload
  };
};