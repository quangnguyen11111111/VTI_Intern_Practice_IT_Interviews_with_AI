import { z } from 'zod';
import {
  emptyQuerySchema,
  idParamsSchema,
  objectIdSchema,
  paginationQuerySchema,
  resourceQuerySchema,
} from './common.validator';

const codeSchema = z
  .string()
  .trim()
  .min(2, 'Mã phải có ít nhất 2 ký tự')
  .max(50, 'Mã không được vượt quá 50 ký tự')
  .regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ được chứa chữ, số, dấu gạch dưới hoặc gạch ngang')
  .transform((value) => value.toUpperCase());

const nameSchema = z.string().trim().min(2).max(100);
const descriptionSchema = z.string().trim().max(1000).optional();
const statusSchema = z.enum(['ACTIVE', 'INACTIVE']).optional();

const taxonomyBodySchema = z
  .object({
    code: codeSchema,
    name: nameSchema,
    description: descriptionSchema,
    status: statusSchema,
  })
  .strict();

const taxonomyUpdateBodySchema = taxonomyBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Dữ liệu cập nhật không được để trống');

const technologyBodySchema = taxonomyBodySchema.extend({
  icon: z.string().trim().max(2048).optional(),
  roles: z
    .array(objectIdSchema)
    .max(100)
    .refine((roles) => new Set(roles).size === roles.length, 'Danh sách Role không được trùng lặp')
    .optional(),
});

const technologyUpdateBodySchema = technologyBodySchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Dữ liệu cập nhật không được để trống');

const technologyQuerySchema = paginationQuerySchema.extend({
  roleId: objectIdSchema.optional(),
});

export const taxonomyListSchema = z.object({ query: paginationQuerySchema });
export const technologyListSchema = z.object({ query: technologyQuerySchema });
export const taxonomyGetSchema = z.object({ params: idParamsSchema, query: resourceQuerySchema });
export const taxonomyCreateSchema = z.object({ body: taxonomyBodySchema, query: emptyQuerySchema });
export const taxonomyUpdateSchema = z.object({
  body: taxonomyUpdateBodySchema,
  params: idParamsSchema,
  query: emptyQuerySchema,
});
export const taxonomyDeleteSchema = z.object({ params: idParamsSchema, query: emptyQuerySchema });
export const technologyCreateSchema = z.object({ body: technologyBodySchema, query: emptyQuerySchema });
export const technologyUpdateSchema = z.object({
  body: technologyUpdateBodySchema,
  params: idParamsSchema,
  query: emptyQuerySchema,
});
