import { useEffect, useRef, type ReactNode } from 'react';
import { refreshSession } from './apiClient';
import { getRefreshToken } from './session';
import { useAuthStore } from './authStore';

export function AuthBootstrap({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.bootstrapStatus);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || useAuthStore.getState().bootstrapStatus === 'ready') return;
    started.current = true;

    const run = async () => {
      useAuthStore.getState().setBootstrapStatus('loading');
      if (getRefreshToken()) {
        try {
          await refreshSession();
        } catch {
          // refreshSession owns fail-closed session and auth-state cleanup.
        }
      }
      useAuthStore.getState().setBootstrapStatus('ready');
    };

    void run();
  }, []);

  if (status !== 'ready') {
    return <div role="status" aria-live="polite">Đang khôi phục phiên…</div>;
  }

  return <>{children}</>;
}
