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
    <div className="relative flex min-h-screen items-center overflow-hidden bg-slate-50 px-4 py-8 selection:bg-indigo-500 selection:text-white sm:px-6 sm:py-12">
      <div className="absolute -left-16 top-0 h-72 w-72 rounded-full bg-purple-300 opacity-60 mix-blend-multiply blur-3xl animate-blob" aria-hidden="true" />
      <div className="absolute -right-16 top-8 h-72 w-72 rounded-full bg-blue-300 opacity-60 mix-blend-multiply blur-3xl animate-blob animation-delay-2000" aria-hidden="true" />
      <div className="absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-indigo-300 opacity-60 mix-blend-multiply blur-3xl animate-blob animation-delay-4000" aria-hidden="true" />

      <main className="relative z-10 mx-auto w-full max-w-md" aria-labelledby="register-title">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-white/70 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Về trang chủ
        </Link>

        <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-7 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:p-9">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent" aria-hidden="true" />

          <header className="mb-7 text-center">
            <div className="mb-4 inline-flex rounded-2xl border border-indigo-100 bg-indigo-50 p-3 shadow-sm">
              <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <h1 id="register-title" className="text-3xl font-extrabold tracking-tight text-slate-900">Đăng ký</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">Tạo tài khoản để bắt đầu luyện phỏng vấn</p>
          </header>

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

          <p className="mt-6 border-t border-slate-100 pt-6 text-center text-sm font-medium text-slate-500">
            Đã có tài khoản?{' '}
            <Link to="/login" className="font-bold text-indigo-600 transition hover:text-purple-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30">
              Đăng nhập
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
