import { useState } from 'react';
import { Link } from 'react-router-dom';

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
        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
              <span className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </span>
              Dashboard Thống Kê
            </h1>
            <p className="mt-2 text-slate-500 font-medium">Tổng quan hệ thống và chỉ số hiệu suất AI</p>
          </div>
          <div className="flex gap-3">
            <Link to="/admin/system-prompts" className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium shadow hover:bg-indigo-700 transition">
              Quản lý Prompts
            </Link>
            <Link to="/admin/users" className="px-4 py-2 bg-white text-indigo-600 border border-indigo-200 rounded-lg font-medium shadow-sm hover:bg-indigo-50 transition">
              Quản lý Users
            </Link>
            <button
              onClick={handleReload}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:text-indigo-600 transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Tải lại
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