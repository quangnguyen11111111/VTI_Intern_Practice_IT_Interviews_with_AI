import type { AdminUser, UserAction } from './types';

interface ConfirmActionModalProps {
  user: AdminUser | null;
  action: UserAction | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmActionModal = ({
  user,
  action,
  isLoading,
  onConfirm,
  onCancel
}: ConfirmActionModalProps) => {
  if (!user || !action) {
    return null;
  }

  const isLock = action === 'LOCK';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
      >
        <div className="flex items-start gap-4">
          <div
            className={
              isLock
                ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600'
                : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600'
            }
          >
            {isLock ? (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16.5 10.5V7a4.5 4.5 0 0 0-9 0v3.5m-1.5 0h12a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 18 21H6a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 6 10.5Z"
                />
              </svg>
            ) : (
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 11V7a4 4 0 1 1 8 0v4m-9 0h10a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7a1 1 0 0 1 1-1h1Z"
                />
              </svg>
            )}
          </div>

          <div>
            <h2
              id="confirm-action-title"
              className="text-xl font-extrabold text-slate-900"
            >
              {isLock
                ? 'Lock user?'
                : 'Unlock user?'}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {isLock
                ? 'This user will be prevented from using the account.'
                : 'This user will be able to use the account again.'}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4">
          <p className="font-bold text-slate-800">
            {user.name}
          </p>

          <p className="mt-1 text-sm text-slate-500">
            {user.email}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={
              isLock
                ? 'inline-flex min-w-[100px] items-center justify-center rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60'
                : 'inline-flex min-w-[100px] items-center justify-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60'
            }
          >
            {isLoading
              ? 'Processing...'
              : isLock
                ? 'Lock user'
                : 'Unlock user'}
          </button>
        </div>
      </div>
    </div>
  );
};