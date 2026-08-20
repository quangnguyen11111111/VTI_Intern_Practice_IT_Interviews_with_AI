import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse } from '../types/response.type';

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Lỗi hệ thống ngoại lệ';
  let errors: any = undefined;

  // Xử lý lỗi từ Zod Validation
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Dữ liệu đầu vào không hợp lệ';
    errors = err.issues.map((e: any) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  } 
  // Xử lý lỗi trùng lặp dữ liệu từ MongoDB (Duplicate Key Error)
  else if (err.code === 11000 && err.keyValue) {
    statusCode = 400;
    message = 'Dữ liệu bị trùng lặp';
    errors = Object.keys(err.keyValue).map(key => ({
        field: key,
        message: `Giá trị '${err.keyValue[key]}' đã tồn tại`
    }));
  }
  // Xử lý lỗi xác thực JWT
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ, vui lòng đăng nhập lại.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn, vui lòng đăng nhập lại.';
  }

  // Trả về phản hồi lỗi tuân theo chuẩn ApiResponse
  const response: ApiResponse = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  // Ở môi trường dev, in thêm stack trace để dễ debug
  if (process.env.NODE_ENV === 'development') {
    response.errors = response.errors || err;
    (response as any).stack = err.stack;
  }

  res.status(statusCode).json(response);
};
