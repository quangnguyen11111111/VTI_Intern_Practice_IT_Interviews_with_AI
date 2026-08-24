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
    <form onSubmit={handleSubmit(submit)} noValidate aria-busy={loading}>
      <fieldset disabled={loading}>
        {fields.map((field) => {
          const fieldError = get(errors, field.name);
          const errorId = `${field.name}-error`;
          return (
            <div key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              <input
                id={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                aria-invalid={Boolean(fieldError)}
                aria-describedby={fieldError ? errorId : undefined}
                {...registerField(field.name)}
              />
              {fieldError?.message && (
                <p id={errorId} role="alert">{String(fieldError.message)}</p>
              )}
            </div>
          );
        })}
        <button type="submit" disabled={loading}>
          {loading ? 'Đang xử lý…' : submitLabel}
        </button>
      </fieldset>
      {serverError?.message && (
        <div role="alert" aria-live="polite">{serverError.message}</div>
      )}
    </form>
  );
}
