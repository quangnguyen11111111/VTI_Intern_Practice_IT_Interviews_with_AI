/**
 * Chuẩn chung cho cấu trúc JSON trả về của mọi API trong hệ thống.
 * @template T Kiểu dữ liệu của payload trả về trong trường data
 */
export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: ApiErrorDetail[];
  requestId?: string;
  stack?: string;
}
