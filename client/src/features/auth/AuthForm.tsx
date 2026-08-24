import { useState } from 'react';
import {
  get,
  useForm,
  type FieldPath,
  type FieldValues,
  type Resolver,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodType } from 'zod';
import { toApiError, type ApiError } from '../../auth/types';

interface AuthField<T extends FieldValues> {
  name: FieldPath<T>;
  label: string;
  type: string;
  autoComplete: string;
}

interface Props<T extends FieldValues> {
  schema: ZodType<T, T>;
  fields: Array<AuthField<T>>;
  submitLabel: string;
  onSubmit: (values: T) => Promise<void>;
  serverError?: ApiError | null;
}

export function AuthForm<T extends FieldValues>({
  schema,
  fields,
  submitLabel,
  onSubmit,
  serverError,
}: Props<T>) {
  const [loading, setLoading] = useState(false);
  const {
    register: registerField,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<T>({ resolver: zodResolver(schema) as Resolver<T> });

  const submit = async (values: T) => {
    setLoading(true);
    try {
      await onSubmit(values);
    } catch (error) {
      const apiError = toApiError(error);
      Object.entries(apiError.fieldErrors ?? {}).forEach(([name, message]) => {
        setError(name as FieldPath<T>, { message });
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-busy={loading}
      className="space-y-6"
    >
      {serverError?.message && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50/90 p-4 text-sm font-medium text-red-700"
        >
          <svg
            className="mt-0.5 h-5 w-5 shrink-0 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {serverError.message}
        </div>
      )}

      <fieldset disabled={loading} className="space-y-5 disabled:opacity-90">
        {fields.map((field) => {
          const fieldError = get(errors, field.name);
          const errorId = `${field.name}-error`;
          const hasError = Boolean(fieldError);

          return (
            <div key={field.name}>
              <label
                htmlFor={field.name}
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                {field.label}
              </label>
              <input
                id={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                aria-invalid={hasError}
                aria-describedby={hasError ? errorId : undefined}
                className={`w-full rounded-xl border-2 px-4 py-3.5 font-medium text-slate-800 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 ${
                  hasError
                    ? 'border-red-300 bg-red-50/40 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                    : 'border-slate-100 bg-slate-50 hover:border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10'
                }`}
                {...registerField(field.name)}
              />
              {fieldError?.message && (
                <p
                  id={errorId}
                  role="alert"
                  className="mt-2 flex items-center gap-2 text-sm font-medium text-red-600"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden="true" />
                  {String(fieldError.message)}
                </p>
              )}
            </div>
          );
        })}

        <button
          type="submit"
          disabled={loading}
          className={`flex w-full items-center justify-center rounded-xl px-6 py-3.5 text-base font-bold text-white shadow-lg transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 ${
            loading
              ? 'cursor-not-allowed bg-slate-400 shadow-slate-300/40'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-500/25 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-purple-700 hover:shadow-indigo-500/35'
          }`}
        >
          {loading ? (
            <>
              <svg
                className="mr-3 h-5 w-5 animate-spin text-white"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Đang xử lý…
            </>
          ) : (
            <>
              {submitLabel}
              <svg
                className="ml-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </fieldset>
    </form>
  );
}
