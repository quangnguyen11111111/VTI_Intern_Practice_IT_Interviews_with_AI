import { z } from 'zod';

const optionalTrimmedString = z
  .string()
  .trim()
  .min(1)
  .optional();

/**
 * History date contract:
 * - YYYY-MM-DD is interpreted as 00:00:00.000 UTC.
 * - ISO date-time values must include Z or an explicit UTC offset.
 * - `from` is inclusive and `to` is exclusive.
 */
const dateQuery = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return !Number.isNaN(
          Date.parse(`${value}T00:00:00.000Z`)
        );
      }

      if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
        return false;
      }

      return !Number.isNaN(Date.parse(value));
    },
    'Ngày phải là YYYY-MM-DD hoặc ISO date-time có timezone'
  )
  .transform((value) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(`${value}T00:00:00.000Z`);
    }

    return new Date(value);
  })
  .optional();

export const interviewHistoryQuerySchema = z
  .object({
    query: z
      .object({
        page: z.coerce
          .number()
          .int('Page phải là số nguyên')
          .min(1, 'Page phải lớn hơn hoặc bằng 1')
          .default(1),
        limit: z.coerce
          .number()
          .int('Limit phải là số nguyên')
          .min(1, 'Limit phải lớn hơn hoặc bằng 1')
          .max(100, 'Limit không được vượt quá 100')
          .default(10),
        role: optionalTrimmedString,
        level: optionalTrimmedString,
        technology: optionalTrimmedString,
        status: z
          .enum([
            'PENDING',
            'GENERATING',
            'IN_PROGRESS',
            'EVALUATING',
            'COMPLETED',
            'FAILED'
          ])
          .optional(),
        from: dateQuery,
        to: dateQuery,
        sort: z
          .enum(['newest', 'oldest'])
          .default('newest')
      })
      .strict()
  })
  .superRefine((value, ctx) => {
    const { from, to } = value.query;

    if (from && to && from >= to) {
      ctx.addIssue({
        code: 'custom',
        path: ['query', 'to'],
        message: 'To phải lớn hơn From'
      });
    }
  });
