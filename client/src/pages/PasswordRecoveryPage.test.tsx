import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { forgotPassword, resetPassword, changePassword, getProfile } from '../auth/apiClient';
import { useAuthStore } from '../auth/authStore';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from '../auth/session';
import type { User } from '../auth/types';
import { ForgotPasswordPage } from './ForgotPasswordPage';
import { ResetPasswordPage } from './ResetPasswordPage';
import { ChangePasswordPage } from './ChangePasswordPage';
import { LoginPage } from './LoginPage';
import { ProfilePage } from './ProfilePage';

vi.mock('../auth/apiClient', () => ({
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  changePassword: vi.fn(),
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

const mockUser: User = {
  id: 'user-1',
  email: 'test@example.com',
  fullName: 'Test User',
  role: 'CANDIDATE',
  status: 'ACTIVE',
  avatarUrl: null,
  currentLevel: 'MIDDLE',
  githubUrl: null,
  linkedinUrl: null,
  createdAt: '2026-08-22T00:00:00.000Z',
};

describe('Password Recovery & Management UI Tests', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.sessionStorage.clear();
    setAccessToken(null);
    setRefreshToken(null);
    useAuthStore.setState({ user: null, bootstrapStatus: 'ready' });
  });

  // =========================================================================
  // 1. ForgotPasswordPage Tests
  // =========================================================================
  describe('ForgotPasswordPage', () => {
    const renderForgotPassword = () =>
      render(
        <MemoryRouter initialEntries={['/forgot-password']}>
          <Routes>
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
            <Route path="/reset-password" element={<div>RESET_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      );

    it('hiển thị đầy đủ label, autocomplete và validation email hợp lệ', async () => {
      const user = userEvent.setup();
      renderForgotPassword();

      const emailInput = screen.getByLabelText('Email');
      expect(emailInput).toHaveAttribute('type', 'email');
      expect(emailInput).toHaveAttribute('autocomplete', 'email');

      await user.type(emailInput, 'invalid-email');
      await user.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));

      expect(await screen.findByText('Email không đúng định dạng')).toBeInTheDocument();
      expect(forgotPassword).not.toHaveBeenCalled();
    });

    it('vô hiệu hóa nút và hiển thị trạng thái loading khi đang gửi yêu cầu', async () => {
      const user = userEvent.setup();
      let resolveSubmit!: (value: null) => void;
      vi.mocked(forgotPassword).mockImplementation(() => new Promise((resolve) => { resolveSubmit = resolve; }));

      renderForgotPassword();

      await user.type(screen.getByLabelText('Email'), 'candidate@example.com');
      await user.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));

      expect(screen.getByRole('button', { name: 'Đang gửi yêu cầu…' })).toBeDisabled();

      resolveSubmit(null);
      expect(await screen.findByText(/Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã xác thực/)).toBeInTheDocument();
    });

    it('hiển thị thông báo lỗi từ server khi email provider thất bại (503)', async () => {
      const user = userEvent.setup();
      vi.mocked(forgotPassword).mockRejectedValue({
        message: 'Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.',
        status: 503,
      });

      renderForgotPassword();

      await user.type(screen.getByLabelText('Email'), 'candidate@example.com');
      await user.click(screen.getByRole('button', { name: 'Gửi mã xác thực' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Không thể gửi email xác thực lúc này. Vui lòng thử lại sau.');
    });

    it('cung cấp đường dẫn quay lại trang đăng nhập và chuyển tiếp đến trang đặt lại mật khẩu', () => {
      renderForgotPassword();

      expect(screen.getByRole('link', { name: /Quay lại đăng nhập/ })).toHaveAttribute('href', '/login');
      expect(screen.getByRole('link', { name: /Đã có mã xác thực\?/ })).toHaveAttribute('href', '/reset-password');
    });
  });

  // =========================================================================
  // 2. ResetPasswordPage Tests
  // =========================================================================
  describe('ResetPasswordPage', () => {
    const renderResetPassword = (initialState?: { email?: string }) =>
      render(
        <MemoryRouter initialEntries={[{ pathname: '/reset-password', state: initialState }]}>
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/login" element={<div>LOGIN_PAGE</div>} />
            <Route path="/forgot-password" element={<div>FORGOT_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      );

    it('hiển thị đầy đủ label, autocomplete và kiểm tra validation client-side', async () => {
      const user = userEvent.setup();
      renderResetPassword();

      expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText('Mã xác thực (OTP)')).toHaveAttribute('autocomplete', 'one-time-code');
      expect(screen.getByLabelText('Mật khẩu mới')).toHaveAttribute('autocomplete', 'new-password');
      expect(screen.getByLabelText('Xác nhận mật khẩu mới')).toHaveAttribute('autocomplete', 'new-password');

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Mã xác thực (OTP)'), '123'); // < 6 digits
      await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewPass123');
      await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'DifferentPass123');
      await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

      expect(await screen.findByText('Mã xác thực phải gồm 6 chữ số')).toBeInTheDocument();
      expect(screen.getByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();
      expect(resetPassword).not.toHaveBeenCalled();
    });

    it('tự động điền email từ location state nếu có', () => {
      renderResetPassword({ email: 'prefilled@example.com' });
      expect(screen.getByLabelText('Email')).toHaveValue('prefilled@example.com');
    });

    it('vô hiệu hóa form và hiển thị loading khi submit, hiển thị màn hình thành công', async () => {
      const user = userEvent.setup();
      let resolveReset!: (value: null) => void;
      vi.mocked(resetPassword).mockImplementation(() => new Promise((resolve) => { resolveReset = resolve; }));

      renderResetPassword();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Mã xác thực (OTP)'), '123456');
      await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewStrongPass123');
      await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'NewStrongPass123');
      await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

      expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();

      resolveReset(null);
      expect(await screen.findByText(/Đặt lại mật khẩu thành công!/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Đăng nhập ngay' })).toBeInTheDocument();
    });

    it('hiển thị lỗi từ server khi OTP không đúng hoặc hết hạn', async () => {
      const user = userEvent.setup();
      vi.mocked(resetPassword).mockRejectedValue({
        message: 'Mã xác thực không hợp lệ hoặc đã hết hạn',
        code: 'AUTH_INVALID_OR_EXPIRED_OTP',
      });

      renderResetPassword();

      await user.type(screen.getByLabelText('Email'), 'test@example.com');
      await user.type(screen.getByLabelText('Mã xác thực (OTP)'), '999999');
      await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewStrongPass123');
      await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'NewStrongPass123');
      await user.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Mã xác thực không hợp lệ hoặc đã hết hạn');
    });
  });

  // =========================================================================
  // 3. ChangePasswordPage Tests
  // =========================================================================
  describe('ChangePasswordPage', () => {
    const renderChangePassword = () =>
      render(
        <MemoryRouter initialEntries={['/change-password']}>
          <Routes>
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/login" element={<div>LOGIN_PAGE_REDIRECTED</div>} />
            <Route path="/profile" element={<div>PROFILE_PAGE</div>} />
          </Routes>
        </MemoryRouter>
      );

    beforeEach(() => {
      useAuthStore.setState({ user: mockUser, bootstrapStatus: 'ready' });
      setAccessToken('mock_access_token');
      setRefreshToken('mock_refresh_token');
    });

    it('hiển thị đầy đủ label, autocomplete và validation mật khẩu mới trùng mật khẩu cũ / mismatch', async () => {
      const user = userEvent.setup();
      renderChangePassword();

      expect(screen.getByLabelText('Mật khẩu hiện tại')).toHaveAttribute('autocomplete', 'current-password');
      expect(screen.getByLabelText('Mật khẩu mới')).toHaveAttribute('autocomplete', 'new-password');
      expect(screen.getByLabelText('Xác nhận mật khẩu mới')).toHaveAttribute('autocomplete', 'new-password');

      await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'OldPass123');
      await user.type(screen.getByLabelText('Mật khẩu mới'), 'OldPass123'); // Same as old
      await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'OldPass123');
      await user.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));

      expect(await screen.findByText('Mật khẩu mới không được trùng với mật khẩu hiện tại')).toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });

    it('từ chối mật khẩu hiện tại ngắn hơn 8 ký tự trước khi gọi API', async () => {
      const user = userEvent.setup();
      renderChangePassword();

      await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'short');
      await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewPassword456');
      await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'NewPassword456');
      await user.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));

      expect(await screen.findByText('Mật khẩu hiện tại phải có ít nhất 8 ký tự')).toBeInTheDocument();
      expect(changePassword).not.toHaveBeenCalled();
    });

    it('đổi mật khẩu thành công: xóa session cục bộ và chuyển hướng về /login', async () => {
      const user = userEvent.setup();
      vi.mocked(changePassword).mockResolvedValue(null);

      renderChangePassword();

      expect(getAccessToken()).toBe('mock_access_token');
      expect(getRefreshToken()).toBe('mock_refresh_token');
      expect(useAuthStore.getState().user).not.toBeNull();

      await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'OldPassword123');
      await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewPassword456');
      await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'NewPassword456');
      await user.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));

      await waitFor(() => {
        expect(changePassword).toHaveBeenCalledWith({
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword456',
        });
      });

      // Local session should be completely cleared
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();

      expect(await screen.findByText('LOGIN_PAGE_REDIRECTED')).toBeInTheDocument();
    });

    it('hiển thị lỗi từ server khi mật khẩu hiện tại không chính xác', async () => {
      const user = userEvent.setup();
      vi.mocked(changePassword).mockRejectedValue({
        message: 'Mật khẩu hiện tại không chính xác',
        code: 'AUTH_INVALID_CURRENT_PASSWORD',
      });

      renderChangePassword();

      await user.type(screen.getByLabelText('Mật khẩu hiện tại'), 'WrongOldPass');
      await user.type(screen.getByLabelText('Mật khẩu mới'), 'NewPassword456');
      await user.type(screen.getByLabelText('Xác nhận mật khẩu mới'), 'NewPassword456');
      await user.click(screen.getByRole('button', { name: 'Cập nhật mật khẩu' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Mật khẩu hiện tại không chính xác');
      expect(getAccessToken()).toBe('mock_access_token');
    });

    it('có đường dẫn điều hướng quay lại trang hồ sơ', () => {
      renderChangePassword();
      expect(screen.getByRole('link', { name: /Quay lại hồ sơ/ })).toHaveAttribute('href', '/profile');
    });
  });

  // =========================================================================
  // 4. Discoverable Navigation Links
  // =========================================================================
  describe('Discoverable Links on LoginPage and ProfilePage', () => {
    it('LoginPage hiển thị liên kết "Quên mật khẩu?" trỏ đến /forgot-password', () => {
      render(
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </MemoryRouter>
      );

      const forgotLink = screen.getByRole('link', { name: 'Quên mật khẩu?' });
      expect(forgotLink).toBeInTheDocument();
      expect(forgotLink).toHaveAttribute('href', '/forgot-password');
    });

    it('ProfilePage hiển thị liên kết "Đổi mật khẩu" trỏ đến /change-password', async () => {
      useAuthStore.setState({ user: mockUser, bootstrapStatus: 'ready' });
      vi.mocked(getProfile).mockResolvedValue(mockUser);

      render(
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </MemoryRouter>
      );

      const changePassLink = await screen.findByRole('link', { name: /Đổi mật khẩu/ });
      expect(changePassLink).toBeInTheDocument();
      expect(changePassLink).toHaveAttribute('href', '/change-password');
    });
  });
});
