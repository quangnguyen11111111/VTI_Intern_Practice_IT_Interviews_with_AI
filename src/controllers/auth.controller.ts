import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/auth.service';
import { ApiResponse } from '../types/response.type';
import { AuthResponseData } from '../types/auth.type';

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
