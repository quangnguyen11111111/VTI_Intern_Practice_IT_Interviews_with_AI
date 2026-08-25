import { Request, Response } from 'express';
import {
  registerUser,
  loginUser,
  refreshAuthTokens,
  logoutUser,
  lockUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from '../services/auth.service';
import { ApiResponse } from '../types/response.type';
import { AuthResponseData, SafeUser } from '../types/auth.type';

export const registerHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await registerUser(req.body);

  const response: ApiResponse<AuthResponseData> = {
    success: true,
    message: 'Đăng ký thành công',
    data: result,
  };

  res.status(201).json(response);
};

export const loginHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await loginUser(req.body);

  const response: ApiResponse<AuthResponseData> = {
    success: true,
    message: 'Đăng nhập thành công',
    data: result,
  };

  res.status(200).json(response);
};

export const changePasswordHandler = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!._id.toString();
  const { currentPassword, newPassword } = req.body;

  await changePassword(userId, currentPassword, newPassword);

  const response: ApiResponse<null> = {
    success: true,
    message: 'Đổi mật khẩu thành công',
  };

  res.status(200).json(response);
};

export const forgotPasswordHandler = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  await requestPasswordReset(email);

  const response: ApiResponse<null> = {
    success: true,
    message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã xác thực để đặt lại mật khẩu.',
  };

  res.status(202).json(response);
};

export const resetPasswordHandler = async (req: Request, res: Response): Promise<void> => {
  const { email, otp, newPassword } = req.body;

  await resetPassword(email, otp, newPassword);

  const response: ApiResponse<null> = {
    success: true,
    message: 'Đặt lại mật khẩu thành công',
  };

  res.status(200).json(response);
};


export const refreshTokenHandler = async (req: Request, res: Response): Promise<void> => {
  const result = await refreshAuthTokens(req.body.refreshToken);

  const response: ApiResponse<AuthResponseData> = {
    success: true,
    message: 'Làm mới token thành công',
    data: result,
  };

  res.status(200).json(response);
};

export const logoutHandler = async (req: Request, res: Response): Promise<void> => {
  await logoutUser(req.body.refreshToken);

  const response: ApiResponse<null> = {
    success: true,
    message: 'Đăng xuất thành công',
  };

  res.status(200).json(response);
};

export const lockUserHandler = async (req: Request, res: Response): Promise<void> => {
  const adminId = req.user!._id.toString();
  const targetUserId = req.params.id as string;

  const result = await lockUser(adminId, targetUserId);

  const response: ApiResponse<{ user: SafeUser }> = {
    success: true,
    message: 'Khóa tài khoản thành công',
    data: { user: result },
  };

  res.status(200).json(response);
};
