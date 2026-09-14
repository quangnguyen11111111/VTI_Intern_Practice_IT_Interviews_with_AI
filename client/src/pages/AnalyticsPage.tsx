import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
    <div className="w-full flex-grow animate-fade-in-up">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumbs */}
        <nav className="flex mb-6 text-sm font-medium text-slate-500" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link to="/" className="inline-flex items-center hover:text-indigo-600 transition-colors">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                Trang chủ
              </Link>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="w-5 h-5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="ml-1 md:ml-2 text-slate-700 font-semibold">Thống kê</span>
              </div>
            </li>
          </ol>
        </nav>

        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            Tiến bộ phỏng vấn
          </h1>
          <p className="mt-4 max-w-2xl text-slate-600 text-lg">Theo dõi xu hướng điểm số của các phiên phỏng vấn đã hoàn thành theo thời gian.</p>
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
