import { useState } from 'react';

import {
  useAdminMetrics
} from '../features/AdminMetrics/useAdminMetrics';

import type {
  AdminMetricsDateRange
} from '../features/AdminMetrics/types';

const formatDateForInput = (value: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
};

const toStartOfDayIso = (value: string) => {
  return new Date(
    `${value}T00:00:00.000Z`
  ).toISOString();
};

const toEndExclusiveIso = (value: string) => {
  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString();
};

export const AdminMetricsPage = () => {
  const {
    dateRange,
    metrics,
    isLoading,
    error,
    handleDateRangeChange,
    handleReload
  } = useAdminMetrics();

  const [from, setFrom] = useState(
    formatDateForInput(dateRange.from)
  );

  const [to, setTo] = useState(
    formatDateForInput(
      new Date(
        new Date(dateRange.to).getTime() -
          24 * 60 * 60 * 1000
      ).toISOString()
    )
  );

  const [validationError, setValidationError] =
    useState<string | null>(null);

  const handleApply = () => {
    if (!from || !to) {
      setValidationError(
        'Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.'
      );
      return;
    }

    if (from > to) {
      setValidationError(
        'Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.'
      );
      return;
    }

    setValidationError(null);

    const nextRange: AdminMetricsDateRange = {
      from: toStartOfDayIso(from),
      to: toEndExclusiveIso(to)
    };

    handleDateRangeChange(nextRange);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Decorative background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-purple-300 opacity-30 blur-3xl" />

        <div className="absolute -right-32 top-40 h-96 w-96 rounded-full bg-blue-300 opacity-30 blur-3xl" />

        <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-indigo-300 opacity-20 blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />

            Admin
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                System Metrics
              </h1>

              <p className="mt-2 max-w-2xl text-slate-600">
                Monitor users, interviews and AI token usage.
              </p>
            </div>

            <button
              type="button"
              onClick={handleReload}
              disabled={isLoading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? 'Refreshing...'
                : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Main card */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          {/* Filters */}
          <div className="border-b border-slate-100 p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <div>
                <label
                  htmlFor="metrics-from"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  From
                </label>

                <input
                  id="metrics-from"
                  type="date"
                  value={from}
                  onChange={(event) =>
                    setFrom(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label
                  htmlFor="metrics-to"
                  className="mb-2 block text-sm font-bold text-slate-700"
                >
                  To
                </label>

                <input
                  id="metrics-to"
                  type="date"
                  value={to}
                  onChange={(event) =>
                    setTo(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <button
                type="button"
                onClick={handleApply}
                disabled={isLoading}
                className="self-end rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>

            {validationError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {validationError}
              </div>
            )}
          </div>

          {/* Feedback */}
          {(error || isLoading) && (
            <div className="px-6 pt-6">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}

              {isLoading && !error && (
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700">
                  Loading system metrics...
                </div>
              )}
            </div>
          )}

          <div className="p-6">
            {!metrics && !isLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-6 py-12 text-center">
                <p className="text-sm font-semibold text-slate-500">
                  No metrics available for the selected period.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* User metrics */}
                <section>
                  <div className="mb-4">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Users
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Current user account snapshot.
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Total Users"
                      value={metrics?.users.total ?? 0}
                    />

                    <MetricCard
                      label="Active"
                      value={metrics?.users.active ?? 0}
                    />

                    <MetricCard
                      label="Locked"
                      value={metrics?.users.locked ?? 0}
                    />

                    <MetricCard
                      label="Inactive"
                      value={metrics?.users.inactive ?? 0}
                    />
                  </div>
                </section>

                {/* Interview metrics */}
                <section>
                  <div className="mb-4">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Interviews
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Interview sessions created in the selected period.
                    </p>
                  </div>

                  <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="text-sm font-bold text-slate-500">
                      Total Interviews
                    </div>

                    <div className="mt-2 text-3xl font-extrabold text-slate-900">
                      {metrics?.interviews.total ?? 0}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <StatusCard
                      label="Pending"
                      value={
                        metrics?.interviews.byStatus.PENDING ??
                        0
                      }
                    />

                    <StatusCard
                      label="Generating"
                      value={
                        metrics?.interviews.byStatus.GENERATING ??
                        0
                      }
                    />

                    <StatusCard
                      label="In Progress"
                      value={
                        metrics?.interviews.byStatus.IN_PROGRESS ??
                        0
                      }
                    />

                    <StatusCard
                      label="Evaluating"
                      value={
                        metrics?.interviews.byStatus.EVALUATING ??
                        0
                      }
                    />

                    <StatusCard
                      label="Completed"
                      value={
                        metrics?.interviews.byStatus.COMPLETED ??
                        0
                      }
                    />

                    <StatusCard
                      label="Failed"
                      value={
                        metrics?.interviews.byStatus.FAILED ??
                        0
                      }
                    />
                  </div>
                </section>

                {/* Token metrics */}
                <section>
                  <div className="mb-4">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      AI Token Usage
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Token usage aggregated from interview sessions.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <MetricCard
                      label="Prompt Tokens"
                      value={
                        metrics?.interviews.promptTokens ??
                        0
                      }
                    />

                    <MetricCard
                      label="Candidate Tokens"
                      value={
                        metrics?.interviews
                          .candidatesTokens ?? 0
                      }
                    />

                    <MetricCard
                      label="Total Tokens"
                      value={
                        metrics?.interviews.totalTokens ??
                        0
                      }
                    />
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

interface MetricCardProps {
  label: string;
  value: number;
}

const MetricCard = ({
  label,
  value
}: MetricCardProps) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-bold text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-extrabold text-slate-900">
        {value.toLocaleString()}
      </div>
    </div>
  );
};

interface StatusCardProps {
  label: string;
  value: number;
}

const StatusCard = ({
  label,
  value
}: StatusCardProps) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-bold text-slate-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-extrabold text-slate-900">
        {value.toLocaleString()}
      </div>
    </div>
  );
};