import type { AdminUser } from './types';

interface AdminUserTableProps {
  users: AdminUser[];
  isLoading: boolean;
  actionLoadingId: string | null;

  onLock: (user: AdminUser) => void;
  onUnlock: (user: AdminUser) => void;
}

export const AdminUserTable = ({
  users,
  isLoading,
  actionLoadingId,
  onLock,
  onUnlock
}: AdminUserTableProps) => {
  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />

          <p className="text-sm font-medium text-slate-500">
            Loading users...
          </p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <svg
            className="h-8 w-8 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5V9H2v11h5m10 0H7m10 0v-2a3 3 0 0 0-3-3h-4a3 3 0 0 0-3 3v2m10 0H7m7-12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
            />
          </svg>
        </div>

        <h3 className="font-bold text-slate-800">
          No users found
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Try changing your search or filter.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-175 border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              User
            </th>

            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              Email
            </th>

            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              Role
            </th>

            <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
              Status
            </th>

            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
              Action
            </th>
          </tr>
        </thead>

        <tbody>
          {users.map((user) => {
            const isActionLoading =
              actionLoadingId === user._id;

            return (
              <tr
                key={user._id}
                className="border-b border-slate-100 transition hover:bg-indigo-50/40"
              >
                {/* Name */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 font-bold text-indigo-600">
                      {user.name.charAt(0).toUpperCase()}
                    </div>

                    <span className="font-semibold text-slate-800">
                      {user.name}
                    </span>
                  </div>
                </td>

                {/* Email */}
                <td className="px-6 py-4 text-sm text-slate-600">
                  {user.email}
                </td>

                {/* Role */}
                <td className="px-6 py-4">
                  <span
                    className={
                      user.role === 'ADMIN'
                        ? 'inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700'
                        : 'inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600'
                    }
                  >
                    {user.role}
                  </span>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <span
                    className={
                      user.status === 'ACTIVE'
                        ? 'inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700'
                        : 'inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700'
                    }
                  >
                    {user.status}
                  </span>
                </td>

                {/* Action */}
                <td className="px-6 py-4 text-right">
                  {user.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => onLock(user)}
                      disabled={isActionLoading}
                      className="inline-flex min-w-22 items-center justify-center rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isActionLoading
                        ? 'Processing...'
                        : 'Lock'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onUnlock(user)}
                      disabled={isActionLoading}
                      className="inline-flex min-w-22 items-center justify-center rounded-xl bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isActionLoading
                        ? 'Processing...'
                        : 'Unlock'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};