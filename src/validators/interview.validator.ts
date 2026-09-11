import { z } from 'zod';
import { emptyQuerySchema, idParamsSchema, objectIdSchema, resourceQuerySchema } from './common.validator';

const taxonomyReferenceSchema = z
  .string()
  .trim()
  .min(1, 'Giá trị taxonomy không được để trống')
  .max(120, 'Giá trị taxonomy không được vượt quá 120 ký tự')
  .refine(
    (value) => !/[\u0000-\u001F\u007F]/.test(value),
    'Giá trị taxonomy chứa ký tự không hợp lệ',
  );

const uniqueTaxonomyReferences = z
  .array(taxonomyReferenceSchema)
  .min(1, 'Cần chọn ít nhất một công nghệ')
  .max(10, 'Chỉ được chọn tối đa 10 công nghệ')
  .refine(
    (values) => new Set(values).size === values.length,
    'Danh sách công nghệ không được trùng lặp',
  );

const setupBodySchema = z
  .object({
    jobPosition: taxonomyReferenceSchema,
    level: taxonomyReferenceSchema,
    techStacks: uniqueTaxonomyReferences,
  })
  .strict();

const multipartTechStacksSchema = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, uniqueTaxonomyReferences.optional().default([]));

const jdSetupBodySchema = z
  .object({
    jobPosition: taxonomyReferenceSchema.optional(),
    level: taxonomyReferenceSchema.optional(),
    techStacks: multipartTechStacksSchema,
  })
  .strict();

const answerSchema = z
  .object({
    questionId: objectIdSchema,
    candidateAnswer: z
      .string()
      .trim()
      .max(5000, 'Câu trả lời không được vượt quá 5000 ký tự'),
  })
  .strict();

const answersSchema = z
  .array(answerSchema)
  .min(1, 'Cần có ít nhất một câu trả lời')
  .max(5, 'Chỉ chấp nhận tối đa 5 câu trả lời')
  .refine(
    (answers) => new Set(answers.map((answer) => answer.questionId)).size === answers.length,
    'Mỗi câu hỏi chỉ được xuất hiện một lần',
  );

const answersBodySchema = z.object({ answers: answersSchema }).strict();

export const interviewCreateSchema = z.object({
  body: setupBodySchema,
  query: emptyQuerySchema,
});

export const interviewJdCreateSchema = z.object({
  body: jdSetupBodySchema,
  query: emptyQuerySchema,
});

export const interviewGetSchema = z.object({
  params: idParamsSchema,
  query: resourceQuerySchema,
});

export const interviewActionSchema = z.object({
  params: idParamsSchema,
  query: emptyQuerySchema,
});

export const interviewAnswersSchema = z.object({
  body: answersBodySchema,
  params: idParamsSchema,
  query: emptyQuerySchema,
});

const optionalTrimmedString = z.string().trim().min(1).optional();

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
        return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
      }
      if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) return false;
      return !Number.isNaN(Date.parse(value));
    },
    'Ngày phải là YYYY-MM-DD hoặc ISO date-time có timezone',
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
        page: z.coerce.number().int('Page phải là số nguyên').min(1, 'Page phải lớn hơn hoặc bằng 1').default(1),
        limit: z.coerce.number().int('Limit phải là số nguyên').min(1, 'Limit phải lớn hơn hoặc bằng 1').max(100, 'Limit không được vượt quá 100').default(10),
        role: optionalTrimmedString,
        level: optionalTrimmedString,
        technology: optionalTrimmedString,
        status: z.enum(['PENDING', 'GENERATING', 'IN_PROGRESS', 'EVALUATING', 'COMPLETED', 'FAILED']).optional(),
        from: dateQuery,
        to: dateQuery,
        sort: z.enum(['newest', 'oldest']).default('newest'),
      })
      .strict(),
  })
  .superRefine((value, ctx) => {
    const { from, to } = value.query;
    if (from && to && from >= to) {
      ctx.addIssue({
        code: 'custom',
        path: ['query', 'to'],
        message: 'To phải lớn hơn From',
      });
    }
  });
