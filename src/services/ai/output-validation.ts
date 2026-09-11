import { z } from 'zod';
import { EvaluationResult, GeneratedQuestion } from '../../domain/interview/types';
import { AiProviderContractError } from './provider-errors';

const localizedSchema = z.object({
  en: z.string().trim().min(1).max(4000),
  vi: z.string().trim().min(1).max(4000)
}).strict();

const generatedQuestionSchema = z.object({
  order: z.number().int().min(1).max(5),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  category: z.string().trim().min(1).max(200).optional(),
  content: localizedSchema
}).strict();

const generatedQuestionsSchema = z.array(generatedQuestionSchema).length(5).superRefine((questions, ctx) => {
  const orders = questions.map((question) => question.order).sort((a, b) => a - b);
  if (orders.some((order, index) => order !== index + 1)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Question orders must be unique and cover 1 through 5'
    });
  }
});

export const RUBRIC_WEIGHTS = {
  TECHNICAL_ACCURACY: 0.35,
  PROBLEM_SOLVING: 0.30,
  COMMUNICATION: 0.15,
  PRACTICAL_APPLICATION: 0.20
} as const;

const dimensionNameSchema = z.enum([
  'TECHNICAL_ACCURACY',
  'PROBLEM_SOLVING',
  'COMMUNICATION',
  'PRACTICAL_APPLICATION'
]);

const evaluationResultSchema = z.object({
  evaluations: z.array(z.object({
    questionId: z.string().regex(/^[a-f\d]{24}$/i),
    feedback: localizedSchema,
    score: z.number().min(0).max(10)
  }).strict()).length(5),
  overallScore: z.number().min(0).max(10),
  dimensions: z.array(z.object({
    name: dimensionNameSchema,
    score: z.number().min(0).max(10),
    reasoning: z.string().trim().min(1).max(4000)
  }).strict()).length(4),
  learningPath: z.array(z.object({
    topic: localizedSchema,
    priority: z.enum(['High', 'Medium', 'Low']),
    suggestion: localizedSchema
  }).strict()).max(20)
}).strict();

const parseOrContractError = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AiProviderContractError();
  }
  return parsed.data;
};

export const validateGeneratedQuestions = (value: unknown): GeneratedQuestion[] =>
  parseOrContractError(generatedQuestionsSchema, value);

export const validateEvaluationResult = (
  value: unknown,
  expectedQuestionIds: string[]
): EvaluationResult => {
  const result = parseOrContractError(evaluationResultSchema, value);
  const expected = [...expectedQuestionIds].sort();
  const actual = result.evaluations.map((evaluation) => evaluation.questionId).sort();
  const dimensionNames = result.dimensions.map((dimension) => dimension.name);

  if (
    new Set(actual).size !== actual.length ||
    actual.length !== expected.length ||
    actual.some((questionId, index) => questionId !== expected[index]) ||
    new Set(dimensionNames).size !== dimensionNames.length
  ) {
    throw new AiProviderContractError();
  }

  const overallScore = Math.round(
    result.dimensions.reduce(
      (sum, dimension) => sum + dimension.score * RUBRIC_WEIGHTS[dimension.name],
      0
    ) * 10
  ) / 10;

  return { ...result, overallScore };
};
