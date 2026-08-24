import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse } from '../types/response.type';

export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  let message = err.message || 'Lỗi hệ thống ngoại lệ';
  let code: string | undefined = typeof err.code === 'string' ? err.code : undefined;
  let errors: Array<{ field: string; message: string }> | undefined = undefined;

  // Xử lý lỗi từ Zod Validation
  if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Dữ liệu đầu vào không hợp lệ';
    code = 'VALIDATION_ERROR';
    errors = err.issues.flatMap((issue: any) => {
      if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
        return issue.keys.map((k: string) => ({
          field: k,
          message: issue.message || `Trường '${k}' không được phép`,
        }));
      }
      const fieldPath = (issue.path || [])
        .filter((p: any) => p !== 'body' && p !== 'query' && p !== 'params')
        .join('.');
      return [
        {
          field: fieldPath || (issue.path ? issue.path.join('.') : 'unknown'),
          message: issue.message,
        },
      ];
    });
  }
  // Xử lý lỗi trùng lặp dữ liệu từ MongoDB (Duplicate Key Error)
  else if (err.code === 11000) {
    statusCode = 409;
    const isEmailDuplicate = Boolean(
      err.keyPattern?.email ||
      err.keyValue?.email ||
      (typeof err.message === 'string' && (err.message.includes('email_1') || err.message.includes('email:')))
    );

    if (isEmailDuplicate) {
      message = 'Email đã được sử dụng';
      code = 'AUTH_EMAIL_ALREADY_EXISTS';
    } else {
      message = 'Dữ liệu đã tồn tại';
      code = 'CONFLICT_ERROR';
    }
    errors = undefined; // Không echo keyValue, email hoặc database internals
  }
  // Xử lý lỗi xác thực JWT
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Token không hợp lệ, vui lòng đăng nhập lại.';
    code = 'AUTH_INVALID_TOKEN';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token đã hết hạn, vui lòng đăng nhập lại.';
    code = 'AUTH_TOKEN_EXPIRED';
  }
  // Lỗi không xác định trong môi trường production
  else if (!err.isOperational && statusCode === 500 && process.env.NODE_ENV === 'production') {
    message = 'Lỗi hệ thống ngoại lệ';
  }

  // Trả về phản hồi lỗi tuân theo chuẩn ApiResponse
  const response: ApiResponse = {
    success: false,
    message,
  };

  if (code) {
    response.code = code;
  }

  if (errors) {
    response.errors = errors;
  }

  // Ở môi trường dev, in thêm stack trace dạng string để debug nếu có
  if (process.env.NODE_ENV === 'development' && typeof err.stack === 'string') {
    (response as any).stack = err.stack;
  }

  res.status(statusCode).json(response);
};
