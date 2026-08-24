import { z } from 'zod';

export const registerSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email('Email không đúng định dạng')
        .max(255, 'Email không được vượt quá 255 ký tự'),
      password: z
        .string()
        .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
        .refine(
          (val) => Buffer.byteLength(val, 'utf8') <= 72,
          { message: 'Mật khẩu không được vượt quá 72 byte' }
        ),
      fullName: z
        .string()
        .trim()
        .min(2, 'Họ và tên phải có ít nhất 2 ký tự')
        .max(100, 'Họ và tên không được vượt quá 100 ký tự'),
    })
    .strict(),
});

export const loginSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email('Email không đúng định dạng')
        .max(255, 'Email không được vượt quá 255 ký tự'),
      password: z
        .string()
        .min(1, 'Mật khẩu là bắt buộc')
        .refine(
          (val) => Buffer.byteLength(val, 'utf8') <= 72,
          { message: 'Mật khẩu không được vượt quá 72 byte' }
        ),
    })
    .strict(),
});
