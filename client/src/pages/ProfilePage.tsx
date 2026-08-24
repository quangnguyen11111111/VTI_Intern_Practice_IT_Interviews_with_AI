import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { getProfile, updateProfile } from '../auth/apiClient';
import { useAuthStore } from '../auth/authStore';
import {
  PROFILE_LEVEL_OPTIONS,
  profileSchema,
  type ProfileFormData,
} from '../auth/schemas';
import { toApiError, type ApiError } from '../auth/types';

const initialsFor = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)![0]}`.toUpperCase();
};

function ProfileAvatar({ url, name }: { url: string; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (url && failedUrl !== url) {
    return (
      <img
        src={url}
        alt={`Ảnh đại diện của ${name}`}
        onError={() => setFailedUrl(url)}
        className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg"
      />
    );
  }

  const initials = initialsFor(name);
  return (
    <div
      data-testid="avatar-fallback"
      aria-label={`Ảnh đại diện mặc định ${initials}`}
      className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-indigo-600 to-purple-600 text-2xl font-bold text-white shadow-lg"
    >
      {initials}
    </div>
  );
}

const emptyProfile: ProfileFormData = {
  fullName: '',
  avatarUrl: '',
  currentLevel: '',
  githubUrl: '',
  linkedinUrl: '',
};

export function ProfilePage() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyProfile,
  });

  const avatarUrl = useWatch({ control, name: 'avatarUrl' });
  const fullName = useWatch({ control, name: 'fullName' });

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const profile = await getProfile();
      setUser(profile);
      reset({
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl ?? '',
        currentLevel: profile.currentLevel ?? '',
        githubUrl: profile.githubUrl ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
      });
    } catch (error) {
      setLoadError(toApiError(error));
    } finally {
      setLoading(false);
    }
  }, [reset, setUser]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadProfile(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadProfile]);

  const submit = async (values: ProfileFormData) => {
    setSaved(false);
    setSaveError(null);
    try {
      const profile = await updateProfile({
        fullName: values.fullName.trim(),
        avatarUrl: values.avatarUrl.trim() || null,
        currentLevel: values.currentLevel || null,
        githubUrl: values.githubUrl.trim() || null,
        linkedinUrl: values.linkedinUrl.trim() || null,
      });
      setUser(profile);
      reset({
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl ?? '',
        currentLevel: profile.currentLevel ?? '',
        githubUrl: profile.githubUrl ?? '',
        linkedinUrl: profile.linkedinUrl ?? '',
      });
      setSaved(true);
    } catch (error) {
      const apiError = toApiError(error);
      setSaveError(apiError);
      for (const [field, message] of Object.entries(apiError.fieldErrors ?? {})) {
        if (field in emptyProfile) {
          setError(field as keyof ProfileFormData, { type: 'server', message });
        }
      }
    }
  };

  const inputClass = (invalid: boolean) =>
    `mt-1.5 w-full rounded-xl border bg-white px-4 py-3 text-slate-800 outline-none transition focus:ring-4 ${
      invalid
        ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
        : 'border-slate-200 focus:border-indigo-500 focus:ring-indigo-100'
    }`;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-5 inline-flex rounded-lg px-2 py-1 font-semibold text-slate-600 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100">
          ← Về trang chủ
        </Link>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60" aria-labelledby="profile-title">
          <header className="flex flex-col items-center gap-4 bg-gradient-to-r from-indigo-50 to-purple-50 px-6 py-8 text-center sm:flex-row sm:text-left">
            <ProfileAvatar url={typeof avatarUrl === 'string' ? avatarUrl : ''} name={fullName || authUser?.fullName || ''} />
            <div>
              <h1 id="profile-title" className="text-3xl font-extrabold text-slate-900">Hồ sơ cá nhân</h1>
              <p className="mt-1 text-slate-600">Thông tin dùng để cá nhân hóa trải nghiệm phỏng vấn.</p>
            </div>
          </header>

          <div className="p-6 sm:p-8">
            {loading && <div role="status" aria-live="polite" className="py-12 text-center font-semibold text-slate-600">Đang tải hồ sơ…</div>}

            {!loading && loadError && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-red-800">
                <p>{loadError.message}</p>
                <button type="button" onClick={() => void loadProfile()} className="mt-4 rounded-xl bg-red-700 px-4 py-2 font-bold text-white">Thử lại</button>
              </div>
            )}

            {!loading && !loadError && (
              <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
                {saved && <div role="status" aria-live="polite" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-semibold text-emerald-800">Cập nhật hồ sơ thành công</div>}
                {saveError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 font-semibold text-red-800">{saveError.message}</div>}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-email" className="text-sm font-semibold text-slate-700">Email</label>
                    <input id="profile-email" type="email" value={authUser?.email ?? ''} disabled className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600" />
                  </div>
                  <div>
                    <label htmlFor="profile-role" className="text-sm font-semibold text-slate-700">Vai trò</label>
                    <input id="profile-role" value={authUser?.role ?? ''} disabled className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-600" />
                  </div>
                </div>

                <div>
                  <label htmlFor="fullName" className="text-sm font-semibold text-slate-700">Họ và tên</label>
                  <input id="fullName" autoComplete="name" {...register('fullName')} aria-invalid={Boolean(errors.fullName)} className={inputClass(Boolean(errors.fullName))} />
                  {errors.fullName && <p role="alert" className="mt-1 text-sm text-red-700">{errors.fullName.message}</p>}
                </div>

                <div>
                  <label htmlFor="currentLevel" className="text-sm font-semibold text-slate-700">Trình độ hiện tại</label>
                  <select id="currentLevel" {...register('currentLevel')} aria-invalid={Boolean(errors.currentLevel)} className={inputClass(Boolean(errors.currentLevel))}>
                    <option value="">Chưa chọn</option>
                    {PROFILE_LEVEL_OPTIONS.map((level) => <option key={level.value} value={level.value}>{level.label}</option>)}
                  </select>
                  {errors.currentLevel && <p role="alert" className="mt-1 text-sm text-red-700">{errors.currentLevel.message}</p>}
                </div>

                {([
                  ['avatarUrl', 'Ảnh đại diện (URL)', 'https://example.com/avatar.jpg'],
                  ['githubUrl', 'GitHub URL', 'https://github.com/username'],
                  ['linkedinUrl', 'LinkedIn URL', 'https://linkedin.com/in/username'],
                ] as const).map(([field, label, placeholder]) => (
                  <div key={field}>
                    <label htmlFor={field} className="text-sm font-semibold text-slate-700">{label}</label>
                    <input id={field} type="url" autoComplete="url" placeholder={placeholder} {...register(field)} aria-invalid={Boolean(errors[field])} className={inputClass(Boolean(errors[field]))} />
                    {errors[field] && <p role="alert" className="mt-1 text-sm text-red-700">{errors[field]?.message}</p>}
                  </div>
                ))}

                <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-indigo-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
