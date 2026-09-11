import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { classifyProviderError } from '../src/services/ai/provider-errors';
import {
  validateEvaluationResult,
  validateGeneratedQuestions
} from '../src/services/ai/output-validation';
import { validEvaluation, validQuestions } from './support/ScriptedAiProvider';

describe('AIP-56 AI provider output contract', () => {
  it('accepts exactly five unique ordered questions and rejects duplicate order', () => {
    expect(validateGeneratedQuestions(validQuestions())).toHaveLength(5);
    const duplicateOrder = validQuestions();
    duplicateOrder[4].order = 4;
    expect(
      () => validateGeneratedQuestions(duplicateOrder),
      'Contract violation: duplicate question order must be rejected before persistence'
    ).toThrowError('AI provider output did not satisfy the contract');
  });

  it('rejects extra keys and invalid question schema without a retryable classification', () => {
    const malformed = validQuestions() as Array<Record<string, unknown>>;
    malformed[0] = { ...malformed[0], leaked: 'unexpected' };
    try {
      validateGeneratedQuestions(malformed);
      throw new Error('Contract violation: strict output accepted an unknown field');
    } catch (error) {
      expect(classifyProviderError(error)).toEqual({
        retryable: false,
        safeCode: 'AI_OUTPUT_INVALID'
      });
    }
  });

  it('validates the four-axis rubric and computes the weighted overall score server-side', () => {
    const ids = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId().toString());
    const questions = ids.map((_id) => ({ _id }));
    const providerResult = validEvaluation(questions);
    providerResult.overallScore = 1;
    const validated = validateEvaluationResult(providerResult, ids);
    expect(validated.overallScore).toBe(7.5);
    expect(validated.dimensions.map((dimension) => dimension.name)).toEqual([
      'TECHNICAL_ACCURACY',
      'PROBLEM_SOLVING',
      'COMMUNICATION',
      'PRACTICAL_APPLICATION'
    ]);
  });

  it('rejects evaluation output referencing a question outside the accepted snapshot', () => {
    const ids = Array.from({ length: 5 }, () => new mongoose.Types.ObjectId().toString());
    const result = validEvaluation(ids.map((_id) => ({ _id })));
    result.evaluations[0].questionId = new mongoose.Types.ObjectId().toString();
    expect(
      () => validateEvaluationResult(result, ids),
      'Contract violation: cross-session question reference must not be persisted'
    ).toThrowError('AI provider output did not satisfy the contract');
  });

  it.each([
    [{ status: 429 }, 'AI_RATE_LIMITED'],
    [{ code: 'ETIMEDOUT' }, 'AI_TIMEOUT'],
    [{ response: { status: 503 } }, 'AI_DEPENDENCY_UNAVAILABLE']
  ])('classifies transient provider failures for bounded durable retry', (error, safeCode) => {
    expect(classifyProviderError(error)).toEqual({ retryable: true, safeCode });
  });
});
