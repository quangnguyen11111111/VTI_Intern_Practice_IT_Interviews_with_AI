import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'ID không đúng định dạng ObjectId');

export const idParamsSchema = z.object({ id: objectIdSchema }).strict();

export const emptyQuerySchema = z.object({}).strict();

export const resourceQuerySchema = z
  .object({
    t: z.coerce.number().int().nonnegative().optional(),
  })
  .strict();

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(1000).default(10),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
    code: z.string().trim().min(1).max(50).transform((value) => value.toUpperCase()).optional(),
  })
  .strict();
