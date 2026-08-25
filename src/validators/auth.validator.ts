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

export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z
        .string()
        .min(8, 'Mật khẩu hiện tại phải có ít nhất 8 ký tự')
        .refine(
          (val) => Buffer.byteLength(val, 'utf8') <= 72,
          { message: 'Mật khẩu không được vượt quá 72 byte' }
        ),
      newPassword: z
        .string()
        .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
        .refine(
          (val) => Buffer.byteLength(val, 'utf8') <= 72,
          { message: 'Mật khẩu không được vượt quá 72 byte' }
        ),
    })
    .strict(),
});

export const forgotPasswordSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email('Email không đúng định dạng')
        .max(255, 'Email không được vượt quá 255 ký tự'),
    })
    .strict(),
});

export const resetPasswordSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email('Email không đúng định dạng')
        .max(255, 'Email không được vượt quá 255 ký tự'),
      otp: z
        .string()
        .trim()
        .regex(/^\d{6}$/, 'Mã xác thực phải gồm đúng 6 chữ số'),
      newPassword: z
        .string()
        .min(8, 'Mật khẩu mới phải có ít nhất 8 ký tự')
        .refine(
          (val) => Buffer.byteLength(val, 'utf8') <= 72,
          { message: 'Mật khẩu không được vượt quá 72 byte' }
        ),
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

export const refreshTokenSchema = z.object({
  body: z
    .object({
      refreshToken: z
        .string()
        .min(1, 'Refresh token là bắt buộc'),
    })
    .strict(),
});

export const logoutSchema = z.object({
  body: z
    .object({
      refreshToken: z
        .string()
        .min(1, 'Refresh token là bắt buộc'),
    })
    .strict(),
});

export const lockUserSchema = z.object({
  params: z
    .object({
      id: z
        .string()
        .regex(/^[0-9a-fA-F]{24}$/, 'ID người dùng không đúng định dạng ObjectId'),
    })
    .strict(),
});
