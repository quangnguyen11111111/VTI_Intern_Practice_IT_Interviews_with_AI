import type { BaseEntity } from '../../services/api/interviewApi';
import type { AnalyticsFilters } from './types';

interface Props {
  filters: AnalyticsFilters;
  roles: BaseEntity[];
  levels: BaseEntity[];
  technologies: BaseEntity[];
  onChange: (next: Partial<AnalyticsFilters>) => void;
}

export const AnalyticsFilters = ({
  filters,
  roles,
  levels,
  technologies,
  onChange
}: Props) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
    <label className="text-sm font-semibold text-slate-700">
      Vai trò
      <select
        aria-label="Lọc theo vai trò"
        value={filters.role ?? ''}
        onChange={(e) =>
          onChange({ role: e.target.value || undefined })
        }
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      >
        <option value="">Tất cả vai trò</option>
        {roles.map((item) => (
          <option key={item._id} value={item._id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>

    <label className="text-sm font-semibold text-slate-700">
      Cấp độ
      <select
        aria-label="Lọc theo cấp độ"
        value={filters.level ?? ''}
        onChange={(e) =>
          onChange({ level: e.target.value || undefined })
        }
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      >
        <option value="">Tất cả cấp độ</option>
        {levels.map((item) => (
          <option key={item._id} value={item._id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>

    <label className="text-sm font-semibold text-slate-700">
      Công nghệ
      <select
        aria-label="Lọc theo công nghệ"
        value={filters.technology ?? ''}
        onChange={(e) =>
          onChange({ technology: e.target.value || undefined })
        }
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      >
        <option value="">Tất cả công nghệ</option>
        {technologies.map((item) => (
          <option key={item._id} value={item._id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>

    <label className="text-sm font-semibold text-slate-700">
      Từ ngày
      <input
        aria-label="Ngày bắt đầu"
        type="date"
        value={filters.from ?? ''}
        onChange={(e) =>
          onChange({ from: e.target.value || undefined })
        }
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      />
    </label>

    <label className="text-sm font-semibold text-slate-700">
      Đến ngày
      <input
        aria-label="Ngày kết thúc"
        type="date"
        value={filters.to ?? ''}
        onChange={(e) =>
          onChange({ to: e.target.value || undefined })
        }
        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      />
    </label>
  </div>
);

