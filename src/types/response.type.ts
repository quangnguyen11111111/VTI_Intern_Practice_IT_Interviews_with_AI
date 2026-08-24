/**
 * Chuẩn chung cho cấu trúc JSON trả về của mọi API trong hệ thống.
 * @template T Kiểu dữ liệu của payload trả về trong trường data
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: any;
}
