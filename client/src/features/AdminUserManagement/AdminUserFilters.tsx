import type { UserStatus } from './types';

interface AdminUserFiltersProps {
  search: string;
  status: UserStatus | undefined;

  onSearchChange: (value: string) => void;

  onStatusChange: (
    value: UserStatus | undefined
  ) => void;
}

export const AdminUserFilters = ({
  search,
  status,
  onSearchChange,
  onStatusChange
}: AdminUserFiltersProps) => {
  return (
    <div className="flex flex-col gap-4 md:flex-row">
      {/* Search */}
      <div className="flex-1">
        <label
          htmlFor="user-search"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Search user
        </label>

        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
            />
          </svg>

          <input
            id="user-search"
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(event) =>
              onSearchChange(event.target.value)
            }
            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>
      </div>

      {/* Status filter */}
      <div className="w-full md:w-52">
        <label
          htmlFor="user-status"
          className="mb-2 block text-sm font-semibold text-slate-700"
        >
          Status
        </label>

        <select
          id="user-status"
          value={status ?? ''}
          onChange={(event) => {
            const value = event.target.value;

            if (
              value === 'ACTIVE' ||
              value === 'LOCKED'
            ) {
              onStatusChange(value);
            } else {
              onStatusChange(undefined);
            }
          }}
          className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
        >
          <option value="">
            All statuses
          </option>

          <option value="ACTIVE">
            Active
          </option>

          <option value="LOCKED">
            Locked
          </option>
        </select>
      </div>
    </div>
  );
};