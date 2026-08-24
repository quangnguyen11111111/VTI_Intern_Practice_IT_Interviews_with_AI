import { z } from 'zod';

export const PROFILE_LEVELS = [
  'FRESHER',
  'JUNIOR',
  'MIDDLE',
  'SENIOR',
  'LEAD',
  'MANAGER',
] as const;

const httpUrl = z
  .string()
  .trim()
  .max(2048, 'URL không được vượt quá 2048 ký tự')
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL phải là đường dẫn tuyệt đối bắt đầu bằng http:// hoặc https://');

const clearableUrl = z.union([httpUrl, z.literal('').transform(() => null), z.null()]);
const clearableLevel = z.union([
  z.enum(PROFILE_LEVELS),
  z.literal('').transform(() => null),
  z.null(),
]);

export const updateProfileBodySchema = z
  .object({
    fullName: z.string().trim().min(2, 'Họ và tên phải có ít nhất 2 ký tự').max(100, 'Họ và tên không được vượt quá 100 ký tự').optional(),
    avatarUrl: clearableUrl.optional(),
    currentLevel: clearableLevel.optional(),
    githubUrl: clearableUrl.optional(),
    linkedinUrl: clearableUrl.optional(),
  })
  .strict()
  .refine((body) => Object.values(body).some((value) => value !== undefined), {
    message: 'Dữ liệu cập nhật không được để trống',
  });

export const updateProfileSchema = z.object({ body: updateProfileBodySchema });
export type UpdateProfileInput = z.infer<typeof updateProfileBodySchema>;
