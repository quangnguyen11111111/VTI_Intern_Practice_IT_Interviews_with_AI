import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  interviewApi,
  type BaseEntity,
  type InterviewHistoryItem,
} from '../services/api/interviewApi';
import { HistoryFilters } from '../features/InterviewHistory/HistoryFilters';
import { HistoryTable } from '../features/InterviewHistory/HistoryTable';
import { useInterviewHistory } from '../features/InterviewHistory/useInterviewHistory';

const catalogMap = (items: BaseEntity[]) =>
  new Map(items.map((item) => [item._id, item.name]));

export const HistoryPage = () => {
  const navigate = useNavigate();

  const {
    filters,
    result,
    isLoading,
    error,
    updateFilters,
    retry,
  } = useInterviewHistory();

  const [roles, setRoles] = useState<BaseEntity[]>([]);
  const [levels, setLevels] = useState<BaseEntity[]>([]);
  const [technologies, setTechnologies] = useState<BaseEntity[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      interviewApi.fetchRoles(),
      interviewApi.fetchLevels(),
      interviewApi.fetchTechnologies(),
    ])
      .then(([nextRoles, nextLevels, nextTechnologies]) => {
        if (cancelled) return;

        setRoles(nextRoles);
        setLevels(nextLevels);
        setTechnologies(nextTechnologies);
      })
      .finally(() => {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const roleNames = useMemo(() => catalogMap(roles), [roles]);
  const levelNames = useMemo(() => catalogMap(levels), [levels]);
  const technologyNames = useMemo(
    () => catalogMap(technologies),
    [technologies],
  );

  const openItem = (item: InterviewHistoryItem) => {
    if (item.status === 'COMPLETED') {
      navigate(`/interview/${item.sessionId}/result`);
      return;
    }

    if (item.status !== 'FAILED') {
      navigate(`/interview/${item.sessionId}`);
    }
  };

  const totalPages = result?.pagination.totalPages ?? 0;
  const page = result?.pagination.page ?? filters.page;
  const canPrevious = page > 1 && !isLoading;
  const canNext = page < totalPages && !isLoading;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700">
            <span className="h-2 w-2 rounded-full bg-indigo-600" />
            Interview
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Lịch sử phỏng vấn
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600">
            Xem lại các phiên phỏng vấn của bạn, lọc theo vị trí, cấp độ, công
            nghệ và trạng thái.
          </p>
        </header>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
          <div className="border-b border-slate-100 p-6">
            <HistoryFilters
              filters={filters}
              roles={roles}
              levels={levels}
              technologies={technologies}
              onChange={updateFilters}
            />

            {catalogLoading && (
              <p
                className="mt-3 text-xs font-medium text-slate-500"
                role="status"
              >
                Đang tải danh mục hiển thị…
              </p>
            )}
          </div>

          <div className="p-6">
            {isLoading && (
              <div
                className="flex min-h-48 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50"
                role="status"
                aria-live="polite"
              >
                Đang tải lịch sử phỏng vấn…
              </div>
            )}

            {!isLoading && error && (
              <div
                className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5"
                role="alert"
              >
                <p className="font-bold text-red-800">
                  Không thể tải lịch sử phỏng vấn
                </p>

                <p className="mt-1 text-sm text-red-700">{error}</p>

                <button
                  type="button"
                  onClick={retry}
                  className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
                >
                  Thử lại
                </button>
              </div>
            )}

            {!isLoading &&
              !error &&
              result &&
              result.items.length === 0 && (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                  <h2 className="text-lg font-bold text-slate-900">
                    Chưa có phiên phỏng vấn phù hợp
                  </h2>

                  <p className="mt-1 max-w-md text-sm text-slate-600">
                    Hãy thay đổi bộ lọc hoặc bắt đầu một phiên phỏng vấn mới.
                  </p>
                </div>
              )}

            {!isLoading &&
              !error &&
              result &&
              result.items.length > 0 && (
                <HistoryTable
                  items={result.items}
                  roleNames={roleNames}
                  levelNames={levelNames}
                  technologyNames={technologyNames}
                  onOpen={openItem}
                />
              )}
          </div>

          {!isLoading && !error && result && (
            <div className="flex flex-col gap-4 border-t border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-medium text-slate-500">
                Trang{' '}
                <span className="font-bold text-slate-700">{page}</span> /{' '}
                <span className="font-bold text-slate-700">
                  {totalPages}
                </span>{' '}
                · {result.pagination.total} phiên
              </p>

              <nav
                aria-label="Phân trang lịch sử phỏng vấn"
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  aria-label="Trang trước"
                  disabled={!canPrevious}
                  onClick={() => updateFilters({ page: page - 1 })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>

                <span
                  aria-current="page"
                  className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-indigo-600 px-3 text-sm font-bold text-white"
                >
                  {page}
                </span>

                <button
                  type="button"
                  aria-label="Trang sau"
                  disabled={!canNext}
                  onClick={() => updateFilters({ page: page + 1 })}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </nav>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};