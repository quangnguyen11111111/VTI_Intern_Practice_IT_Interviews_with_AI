import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { AuthForm } from '../features/auth/AuthForm';
import { loginSchema, type LoginInput } from '../auth/schemas';
import { login } from '../auth/apiClient';
import { setAccessToken, setRefreshToken } from '../auth/session';
import { useAuthStore } from '../auth/authStore';
import { roleLanding } from '../auth/routePolicy';
import { toApiError, type ApiError } from '../auth/types';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<ApiError | null>(null);
  const returnPath = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  return (
    <main>
      <h1>Đăng nhập</h1>
      <AuthForm<LoginInput>
        schema={loginSchema}
        fields={[
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Mật khẩu', type: 'password', autoComplete: 'current-password' },
        ]}
        submitLabel="Đăng nhập"
        serverError={error}
        onSubmit={async (values) => {
          setError(null);
          try {
            const result = await login(values);
            setAccessToken(result.tokens.accessToken);
            setRefreshToken(result.tokens.refreshToken);
            useAuthStore.getState().setUser(result.user);
            navigate(returnPath ?? roleLanding(result.user.role), { replace: true });
          } catch (requestError) {
            const apiError = toApiError(requestError);
            setError(apiError);
            throw apiError;
          }
        }}
      />
      <Link to="/register">Đăng ký</Link>
    </main>
  );
}
