import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from './types';
import { useAuthStore } from './authStore';
import { canAccess, roleLanding } from './routePolicy';

const BootstrapPending = () => <div role="status" aria-live="polite">Đang xác thực…</div>;

export function ProtectedRoute({ allowedRoles }: { allowedRoles: Role[] }) {
  const { user, bootstrapStatus } = useAuthStore();
  const location = useLocation();

  if (bootstrapStatus !== 'ready') return <BootstrapPending />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!canAccess(user.role, allowedRoles)) {
    return <Navigate to={roleLanding(user.role)} replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { user, bootstrapStatus } = useAuthStore();

  if (bootstrapStatus !== 'ready') return <BootstrapPending />;
  if (user) return <Navigate to={roleLanding(user.role)} replace />;
  return <Outlet />;
}
