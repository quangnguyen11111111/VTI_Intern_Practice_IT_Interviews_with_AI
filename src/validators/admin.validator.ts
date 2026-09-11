import { z } from 'zod';
import { emptyQuerySchema, idParamsSchema } from './common.validator';

const adminUserQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().min(1).max(100).optional(),
    status: z.enum(['ACTIVE', 'LOCKED']).optional(),
  })
  .strict();

const dateRangeQuerySchema = z
  .object({
    from: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'from phải là ngày hợp lệ'),
    to: z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), 'to phải là ngày hợp lệ'),
  })
  .strict()
  .refine((range) => new Date(range.from) < new Date(range.to), {
    message: 'from phải sớm hơn to',
    path: ['from'],
  });

export const adminUserListSchema = z.object({ query: adminUserQuerySchema });
export const adminUserActionSchema = z.object({ params: idParamsSchema, query: emptyQuerySchema });
export const adminMetricsSchema = z.object({ query: dateRangeQuerySchema });
