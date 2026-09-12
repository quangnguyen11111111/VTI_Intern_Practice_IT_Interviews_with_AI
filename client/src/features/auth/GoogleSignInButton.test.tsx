import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { GoogleSignInButton } from './GoogleSignInButton';
import * as apiClient from '../../auth/apiClient';
import * as googleIdentity from '../../auth/googleIdentity';

const mockUser = {
  id: 'user-1',
  email: 'googleuser@gmail.com',
  fullName: 'Google User',
  role: 'CANDIDATE' as const,
  status: 'ACTIVE' as const,
  createdAt: '',
};

const mockAuthResponse = {
  user: mockUser,
  tokens: { accessToken: 'google-access-token', refreshToken: 'google-refresh-token' },
};

describe('GoogleSignInButton component', () => {
  beforeEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('1. Hiển thị trạng thái disabled an toàn khi thiếu VITE_GOOGLE_CLIENT_ID', async () => {
    const originalEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', '');

    const initSpy = vi.spyOn(googleIdentity, 'initializeGoogleIdentity');
    const loginSpy = vi.spyOn(apiClient, 'googleLogin');

    render(<GoogleSignInButton mode="signin" />);

    const button = screen.getByRole('button', { name: 'Đăng nhập bằng Google' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    expect(initSpy).not.toHaveBeenCalled();
    expect(loginSpy).not.toHaveBeenCalled();

    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', originalEnv ?? '');
  });

  it('2. Khởi tạo GIS với clientId khi VITE_GOOGLE_CLIENT_ID được cấu hình', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    const initSpy = vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockResolvedValue(() => {});

    render(<GoogleSignInButton mode="signup" />);

    expect(screen.getByRole('button', { name: 'Đăng ký bằng Google' })).toBeInTheDocument();
    expect(initSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'test-client-id.apps.googleusercontent.com',
      })
    );
  });

  it('3. Xử lý đăng nhập Google thành công và gọi onSuccess', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    let gisCallback: (response: { credential: string }) => void = () => {};
    vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation(async (config) => {
      gisCallback = config.callback;
      return () => {};
    });

    const googleLoginSpy = vi.spyOn(apiClient, 'googleLogin').mockResolvedValue(mockAuthResponse);
    const onSuccess = vi.fn();

    render(<GoogleSignInButton mode="signin" onSuccess={onSuccess} />);

    // Giả lập GIS trả về credential
    gisCallback({ credential: 'mock-google-id-token' });

    await waitFor(() => {
      expect(googleLoginSpy).toHaveBeenCalledWith({ credential: 'mock-google-id-token' });
      expect(onSuccess).toHaveBeenCalledWith(mockAuthResponse);
    });
  });

  it('4. Hiển thị thông báo lỗi khi xác thực Google thất bại và gọi onError', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    let gisCallback: (response: { credential: string }) => void = () => {};
    vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockImplementation(async (config) => {
      gisCallback = config.callback;
      return () => {};
    });

    vi.spyOn(apiClient, 'googleLogin').mockRejectedValue({
      message: 'Google credential không hợp lệ',
      code: 'AUTH_INVALID_GOOGLE_CREDENTIAL',
      status: 401,
    });

    const onError = vi.fn();

    render(<GoogleSignInButton mode="signin" onError={onError} />);

    gisCallback({ credential: 'invalid-token' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Google credential không hợp lệ');
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Google credential không hợp lệ',
        })
      );
    });
  });

  it('5. Gọi cleanup khi component unmount', async () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id.apps.googleusercontent.com');

    const cleanupMock = vi.fn();
    vi.spyOn(googleIdentity, 'initializeGoogleIdentity').mockResolvedValue(cleanupMock);

    const { unmount } = render(<GoogleSignInButton mode="signin" />);

    await waitFor(() => {
      expect(googleIdentity.initializeGoogleIdentity).toHaveBeenCalled();
    });

    unmount();
    expect(cleanupMock).toHaveBeenCalled();
  });
});
