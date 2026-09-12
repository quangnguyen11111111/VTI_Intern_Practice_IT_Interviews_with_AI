import { useEffect, useMemo, useState } from 'react';
import { interviewApi, type BaseEntity } from '../services/api/interviewApi';
import { AnalyticsFilters } from '../features/InterviewAnalytics/AnalyticsFilters';
import { AnalyticsChart } from '../features/InterviewAnalytics/AnalyticsChart';
import { useInterviewAnalytics } from '../features/InterviewAnalytics/useInterviewAnalytics';

const DIMENSIONS = [
  'Technical Depth',
  'Problem Solving',
  'System Design & Best Practices',
  'Communication',
  'Practical Experience'
];

const labels: Record<string, string> = {
  'Technical Depth': 'Chuyên môn',
  'Problem Solving': 'Giải quyết vấn đề',
  'System Design & Best Practices': 'Thiết kế hệ thống',
  Communication: 'Giao tiếp',
  'Practical Experience': 'Thực chiến'
};

const averageLabel = (value: number | null) => value == null ? '—' : `${value.toFixed(2)} / 10`;

export const AnalyticsPage = () => {
  const { filters, data, isLoading, error, updateFilters, retry } = useInterviewAnalytics();
  const [roles, setRoles] = useState<BaseEntity[]>([]);
  const [levels, setLevels] = useState<BaseEntity[]>([]);
  const [technologies, setTechnologies] = useState<BaseEntity[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      interviewApi.fetchRoles(),
      interviewApi.fetchLevels(),
      interviewApi.fetchTechnologies(),
    ]).then(([nextRoles, nextLevels, nextTechnologies]) => {
      if (cancelled) return;
      setRoles(nextRoles);
      setLevels(nextLevels);
      setTechnologies(nextTechnologies);
    });
    return () => { cancelled = true; };
  }, []);

  const dimensionScores = useMemo(() => new Map(data?.summary.dimensions.map((dimension) => [dimension.name, dimension.score]) ?? []), [data]);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />Analytics
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Tiến bộ phỏng vấn</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Theo dõi xu hướng điểm số của các phiên phỏng vấn đã hoàn thành theo thời gian.</p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="border-b border-slate-100 p-6">
            <AnalyticsFilters filters={filters} roles={roles} levels={levels} technologies={technologies} onChange={updateFilters} />
          </div>

          <div className="p-6">
            {isLoading && (
              <div className="flex min-h-56 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50" role="status" aria-live="polite">Đang tải dữ liệu phân tích…</div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5" role="alert">
                <p className="font-bold text-red-800">Không thể tải dữ liệu phân tích</p>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button type="button" onClick={retry} className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100">Thử lại</button>
              </div>
            )}

            {!isLoading && !error && data && data.series.length === 0 && (
              <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <h2 className="text-lg font-bold text-slate-900">Chưa có dữ liệu xu hướng</h2>
                <p className="mt-1 max-w-md text-sm text-slate-600">Hãy hoàn thành thêm một phiên phỏng vấn hoặc thử thay đổi bộ lọc và khoảng thời gian.</p>
              </div>
            )}

            {!isLoading && !error && data && data.series.length > 0 && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><p className="text-sm font-semibold text-slate-500">Phiên hoàn thành</p><p className="mt-2 text-3xl font-extrabold text-slate-900">{data.summary.totalCompleted}</p></article>
                  <article className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5"><p className="text-sm font-semibold text-indigo-700">Điểm tổng thể</p><p className="mt-2 text-3xl font-extrabold text-indigo-700">{averageLabel(data.summary.averageOverallScore)}</p></article>
                  {DIMENSIONS.map((name) => (
                    <article key={name} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">{labels[name]}</p><p className="mt-2 text-2xl font-extrabold text-slate-900">{averageLabel(dimensionScores.get(name) ?? null)}</p></article>
                  ))}
                </div>

                <section className="mt-8" aria-labelledby="analytics-chart-title">
                  <div className="mb-4"><h2 id="analytics-chart-title" className="text-xl font-extrabold text-slate-900">Xu hướng điểm theo ngày</h2><p className="mt-1 text-sm text-slate-500">Mỗi điểm dữ liệu là trung bình của các phiên hoàn thành trong ngày UTC tương ứng.</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-5"><AnalyticsChart series={data.series} /></div>
                </section>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
