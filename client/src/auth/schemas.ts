import { z } from 'zod';

const utf8Max72 = (value: string) => new TextEncoder().encode(value).length <= 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Email không đúng định dạng')
  .max(255, 'Email không được vượt quá 255 ký tự');

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .refine(utf8Max72, 'Mật khẩu không được vượt quá 72 byte');

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Mật khẩu là bắt buộc')
    .refine(utf8Max72, 'Mật khẩu không được vượt quá 72 byte'),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z
    .string()
    .trim()
    .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
    .max(100, 'Họ và tên không được vượt quá 100 ký tự'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
