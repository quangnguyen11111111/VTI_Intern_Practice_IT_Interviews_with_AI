export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; // Phân biệt lỗi do logic xử lý (true) với lỗi hệ thống/bugs (false)
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}
