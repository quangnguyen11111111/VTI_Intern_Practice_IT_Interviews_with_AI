import { useEffect, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  getLeaderboard,
  getLevels,
  getRoles,
  type LeaderboardResult,
  type TaxonomyItem,
} from '../auth/apiClient';

export function LeaderboardPage() {
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [role, setRole] = useState('');
  const [level, setLevel] = useState('');
  const [roles, setRoles] = useState<TaxonomyItem[]>([]);
  const [levels, setLevels] = useState<TaxonomyItem[]>([]);
  const [data, setData] = useState<LeaderboardResult | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    Promise.all([
      getRoles({ page: 1, limit: 100 }),
      getLevels({ page: 1, limit: 100 }),
    ])
      .then(([roleData, levelData]) => {
        setRoles(roleData.roles ?? []);
        setLevels(levelData.levels ?? []);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let live = true;

    const params: Record<string, string | number> = {
      period,
      page,
      limit: 20,
    };

    if (role) {
      params.role = role;
    }

    if (level) {
      params.level = level;
    }

    getLeaderboard(params)
      .then((result) => {
        if (live) {
          setData(result);
          setError('');
        }
      })
      .catch((error: unknown) => {
        if (!live) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Không thể tải leaderboard';

        setError(message);
      });

    return () => {
      live = false;
    };
  }, [period, role, level, page]);

  const changeScope =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLSelectElement>) => {
      setter(event.target.value);
      setPage(1);
    };

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link to="/">← Trang chủ</Link>

        <h1 className="mt-6 text-3xl font-extrabold">Bảng xếp hạng</h1>

        <div className="my-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setPeriod('weekly');
              setPage(1);
            }}
            className="rounded-xl border px-4 py-2"
          >
            Tuần
          </button>

          <button
            type="button"
            onClick={() => {
              setPeriod('monthly');
              setPage(1);
            }}
            className="rounded-xl border px-4 py-2"
          >
            Tháng
          </button>

          <select
            aria-label="Role"
            value={role}
            onChange={changeScope(setRole)}
            className="rounded-xl border px-3 py-2"
          >
            <option value="">Tất cả Role</option>

            {roles.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Level"
            value={level}
            onChange={changeScope(setLevel)}
            className="rounded-xl border px-3 py-2"
          >
            <option value="">Tất cả Level</option>

            {levels.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-2xl bg-white shadow">
          <table className="w-full">
            <thead>
              <tr>
                <th className="p-3 text-left">Hạng</th>
                <th className="p-3 text-left">Tên hiển thị</th>
                <th className="p-3 text-left">Điểm</th>
                <th className="p-3 text-left">Role</th>
                <th className="p-3 text-left">Level</th>
              </tr>
            </thead>

            <tbody>
              {data?.items.map((item) => (
                <tr
                  key={`${item.rank}-${item.score}-${item.role ?? ''}-${item.level ?? ''}`}
                  className="border-t"
                >
                  <td className="p-3">{item.rank}</td>
                  <td className="p-3">{item.displayName}</td>
                  <td className="p-3">{item.score}</td>
                  <td className="p-3">{item.role ?? '—'}</td>
                  <td className="p-3">{item.level ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {data?.items.length === 0 && (
            <p className="p-6 text-center">
              Chưa có dữ liệu đủ điều kiện.
            </p>
          )}
        </div>

        {data && data.pagination.totalPages > 1 && (
          <div className="mt-4 flex justify-between">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              ← Trước
            </button>

            <span>
              Trang {page}/{data.pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Sau →
            </button>
          </div>
        )}
      </div>
    </main>
  );
}