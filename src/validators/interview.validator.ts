import { z } from 'zod';
import { emptyQuerySchema, idParamsSchema, objectIdSchema, resourceQuerySchema } from './common.validator';

const uniqueObjectIds = z
  .array(objectIdSchema)
  .min(1, 'Cần chọn ít nhất một công nghệ')
  .max(10, 'Chỉ được chọn tối đa 10 công nghệ')
  .refine((ids) => new Set(ids).size === ids.length, 'Danh sách công nghệ không được trùng lặp');

const setupBodySchema = z
  .object({
    jobPosition: objectIdSchema,
    level: objectIdSchema,
    techStacks: uniqueObjectIds,
  })
  .strict();

const multipartTechStacksSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}, uniqueObjectIds.optional().default([]));

const jdSetupBodySchema = z
  .object({
    jobPosition: objectIdSchema.optional(),
    level: objectIdSchema.optional(),
    techStacks: multipartTechStacksSchema,
  })
  .strict();

const answerSchema = z
  .object({
    questionId: objectIdSchema,
    candidateAnswer: z.string().trim().max(5000, 'Câu trả lời không được vượt quá 5000 ký tự'),
  })
  .strict();

const answersSchema = z
  .array(answerSchema)
  .min(1, 'Cần có ít nhất một câu trả lời')
  .max(5, 'Chỉ chấp nhận tối đa 5 câu trả lời')
  .refine(
    (answers) => new Set(answers.map((answer) => answer.questionId)).size === answers.length,
    'Mỗi câu hỏi chỉ được xuất hiện một lần'
  );

const answersBodySchema = z.object({ answers: answersSchema }).strict();

export const interviewCreateSchema = z.object({ body: setupBodySchema, query: emptyQuerySchema });
export const interviewJdCreateSchema = z.object({ body: jdSetupBodySchema, query: emptyQuerySchema });
export const interviewGetSchema = z.object({ params: idParamsSchema, query: resourceQuerySchema });
export const interviewActionSchema = z.object({ params: idParamsSchema, query: emptyQuerySchema });
export const interviewAnswersSchema = z.object({
  body: answersBodySchema,
  params: idParamsSchema,
  query: emptyQuerySchema,
});
