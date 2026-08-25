import { beforeEach, describe, expect, it, vi } from 'vitest';
import { login, logout, request } from './apiClient';
import { setAccessToken, setRefreshToken, getAccessToken, getRefreshToken } from './session';
import { useAuthStore } from './authStore';

const user = { id: '1', email: 'a@example.com', fullName: 'A', role: 'CANDIDATE' as const, status: 'ACTIVE' as const, createdAt: '' };
const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const unauthorized = () => new Response(JSON.stringify({ message: 'no', code: 'AUTH_UNAUTHORIZED' }), { status: 401 });

describe('api client auth boundaries', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    setAccessToken('old');
    setRefreshToken('refresh');
    useAuthStore.setState({ user, bootstrapStatus: 'ready' });
  });

  it('single-flights refresh and retries each original request exactly once', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => unauthorized())
      .mockImplementationOnce(async () => unauthorized())
      .mockImplementationOnce(async () => ok({ user, tokens: { accessToken: 'new', refreshToken: 'next' } }))
      .mockImplementationOnce(async () => ok({ answer: 1 }))
      .mockImplementationOnce(async () => ok({ answer: 2 }));

    await expect(Promise.all([request('questions'), request('profile')])).resolves.toHaveLength(2);

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(urls.filter((url) => url.endsWith('/questions'))).toHaveLength(2);
    expect(urls.filter((url) => url.endsWith('/profile'))).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect((fetchMock.mock.calls[3][1]?.headers as Headers).get('Authorization')).toBe('Bearer new');
    expect((fetchMock.mock.calls[4][1]?.headers as Headers).get('Authorization')).toBe('Bearer new');
  });

  it('clears both tokens and Zustand user when refresh fails', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(async () => unauthorized())
      .mockImplementationOnce(async () => unauthorized());

    await expect(request('questions')).rejects.toBeTruthy();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('never refreshes register, login, refresh, or logout requests', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => unauthorized());
    for (const path of ['auth/register', 'auth/login', 'auth/refresh', 'auth/logout']) {
      await expect(request(path, { method: 'POST' })).rejects.toBeTruthy();
    }

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://test.local').pathname)).toEqual([
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect((init?.headers as Headers).has('Authorization')).toBe(false);
    }
  });

  it('clears local auth state even when backend logout fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: 'Phiên đăng nhập không tồn tại',
      code: 'AUTH_INVALID_REFRESH_TOKEN',
    }), { status: 401 }));

    await expect(logout()).rejects.toBeTruthy();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('maps canonical server field errors without exposing the submitted value', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'email', message: 'Email không đúng định dạng' }],
    }), { status: 400 }));

    await expect(login({ email: 'invalid', password: 'password' })).rejects.toMatchObject({
      message: 'Dữ liệu không hợp lệ',
      code: 'VALIDATION_ERROR',
      fieldErrors: { email: 'Email không đúng định dạng' },
      status: 400,
    });
  });
});
