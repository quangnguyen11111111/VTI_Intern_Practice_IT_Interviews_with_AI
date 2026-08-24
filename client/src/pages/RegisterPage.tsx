import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthForm } from '../features/auth/AuthForm';
import { registerSchema, type RegisterInput } from '../auth/schemas';
import { register } from '../auth/apiClient';
import { setAccessToken, setRefreshToken } from '../auth/session';
import { useAuthStore } from '../auth/authStore';
import { roleLanding } from '../auth/routePolicy';
import { toApiError, type ApiError } from '../auth/types';

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<ApiError | null>(null);

  return (
    <main>
      <h1>Đăng ký</h1>
      <AuthForm<RegisterInput>
        schema={registerSchema}
        fields={[
          { name: 'fullName', label: 'Họ và tên', type: 'text', autoComplete: 'name' },
          { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
          { name: 'password', label: 'Mật khẩu', type: 'password', autoComplete: 'new-password' },
        ]}
        submitLabel="Đăng ký"
        serverError={error}
        onSubmit={async (values) => {
          setError(null);
          try {
            const result = await register(values);
            setAccessToken(result.tokens.accessToken);
            setRefreshToken(result.tokens.refreshToken);
            useAuthStore.getState().setUser(result.user);
            navigate(roleLanding(result.user.role), { replace: true });
          } catch (requestError) {
            const apiError = toApiError(requestError);
            setError(apiError);
            throw apiError;
          }
        }}
      />
      <Link to="/login">Đăng nhập</Link>
    </main>
  );
}
