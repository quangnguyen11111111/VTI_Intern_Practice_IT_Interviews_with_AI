import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema, type ForgotPasswordInput } from '../auth/schemas';
import { forgotPassword } from '../auth/apiClient';
import { toApiError, type ApiError } from '../auth/types';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<ApiError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    setServerError(null);
    setIsSuccess(false);
    try {
      await forgotPassword(values);
      setSubmittedEmail(values.email);
      setIsSuccess(true);
    } catch (err) {
      setServerError(toApiError(err));
    }
  };

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden bg-slate-50 px-4 py-8 selection:bg-indigo-500 selection:text-white sm:px-6 sm:py-12">
      <div className="absolute -left-16 top-0 h-72 w-72 rounded-full bg-purple-300 opacity-60 mix-blend-multiply blur-3xl animate-blob" aria-hidden="true" />
      <div className="absolute -right-16 top-8 h-72 w-72 rounded-full bg-blue-300 opacity-60 mix-blend-multiply blur-3xl animate-blob animation-delay-2000" aria-hidden="true" />
      <div className="absolute -bottom-20 left-1/3 h-72 w-72 rounded-full bg-indigo-300 opacity-60 mix-blend-multiply blur-3xl animate-blob animation-delay-4000" aria-hidden="true" />

      <main className="relative z-10 mx-auto w-full max-w-md" aria-labelledby="forgot-title">
        <Link
          to="/login"
          className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 transition hover:bg-white/70 hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/15"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Quay lại đăng nhập
        </Link>

        <section className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/80 p-7 shadow-xl shadow-slate-900/5 backdrop-blur-xl sm:p-9">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-300 to-transparent" aria-hidden="true" />

          <header className="mb-7 text-center">
            <div className="mb-4 inline-flex rounded-2xl border border-indigo-100 bg-indigo-50 p-3 shadow-sm">
              <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <h1 id="forgot-title" className="text-3xl font-extrabold tracking-tight text-slate-900">Quên mật khẩu</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">Nhập email của bạn để nhận mã xác thực đặt lại mật khẩu</p>
          </header>

          {isSuccess ? (
            <div className="space-y-6">
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 text-sm font-medium text-emerald-800"
              >
                <div className="flex items-center gap-3">
                  <svg className="h-6 w-6 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã xác thực để đặt lại mật khẩu.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate('/reset-password', { state: { email: submittedEmail } })}
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:from-indigo-700 hover:to-purple-700"
              >
                Nhập mã xác thực để đặt lại mật khẩu
                <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsSuccess(false)}
                  className="text-sm font-semibold text-slate-500 hover:text-indigo-600"
                >
                  Gửi lại yêu cầu với email khác
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate aria-busy={isSubmitting} className="space-y-5">
              {serverError?.message && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/90 p-4 text-sm font-medium text-red-700"
                >
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {serverError.message}
                </div>
              )}

              <fieldset disabled={isSubmitting} className="space-y-5 disabled:opacity-90">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    placeholder="name@example.com"
                    className={`w-full rounded-xl border-2 px-4 py-3.5 font-medium text-slate-800 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 ${
                      errors.email
                        ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                        : 'border-slate-100 bg-slate-50 hover:border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10'
                    }`}
                    {...register('email')}
                  />
                  {errors.email?.message && (
                    <p id="email-error" role="alert" className="mt-2 flex items-center gap-2 text-sm font-medium text-red-600">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-base font-bold text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
                    isSubmitting
                      ? 'cursor-not-allowed bg-slate-400 shadow-slate-300/40'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-500/25 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-purple-700 hover:shadow-indigo-500/35'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="mr-3 h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Đang gửi yêu cầu…
                    </>
                  ) : (
                    <>
                      Gửi mã xác thực
                      <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </fieldset>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6 text-sm font-medium text-slate-500">
            <Link to="/login" className="font-bold text-indigo-600 transition hover:text-purple-600 hover:underline">
              ← Đăng nhập
            </Link>
            <Link to="/reset-password" className="font-bold text-indigo-600 transition hover:text-purple-600 hover:underline">
              Đã có mã xác thực?
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
