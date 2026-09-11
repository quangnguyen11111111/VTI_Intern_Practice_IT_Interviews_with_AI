import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import {
  interviewAnswersSchema,
  interviewCreateSchema,
  interviewJdCreateSchema,
} from '../src/validators/interview.validator';
import {
  technologyCreateSchema,
  technologyListSchema,
  technologyUpdateSchema,
} from '../src/validators/taxonomy.validator';

const id = () => new mongoose.Types.ObjectId().toString();

describe('AIP-55 validation branch contracts', () => {
  it('normalizes manual defaults and accepts already-parsed multipart arrays', () => {
    const manual = interviewCreateSchema.parse({
      body: { jobPosition: id(), level: id(), techStacks: [id()] },
      query: {},
    });
    const multipart = interviewJdCreateSchema.parse({
      body: { jobPosition: id(), level: id(), techStacks: [id()] },
      query: {},
    });

    expect(manual.body).toMatchObject({
      language: 'VI',
      secondsPerQuestion: 300,
      strategy: 'STANDARD',
    });
    expect(multipart.body.techStacks).toHaveLength(1);
  });

  it('rejects duplicate answers, oversized answers, and unknown answer fields', () => {
    const questionId = id();
    for (const answers of [
      [
        { questionId, candidateAnswer: 'first' },
        { questionId, candidateAnswer: 'duplicate' },
      ],
      [{ questionId, candidateAnswer: 'x'.repeat(5001) }],
      [{ questionId, candidateAnswer: 'answer', ownerId: id() }],
    ]) {
      expect(interviewAnswersSchema.safeParse({
        body: { answers },
        params: { id: id() },
        query: {},
      }).success).toBe(false);
    }
  });

  it('covers technology roles, optional fields, filters, and strict updates', () => {
    const roleId = id();
    const created = technologyCreateSchema.parse({
      body: {
        code: 'aip55-tech',
        name: 'AIP-55 Technology',
        roles: [roleId],
        status: 'ACTIVE',
        description: 'Fixture',
        icon: 'https://cdn.example.test/icon.svg',
      },
      query: {},
    });
    const filtered = technologyListSchema.parse({
      query: { page: '2', limit: '5', status: 'INACTIVE', code: 'aip55-tech', roleId },
    });

    expect(created.body.code).toBe('AIP55-TECH');
    expect(filtered.query).toMatchObject({ page: 2, limit: 5, code: 'AIP55-TECH', roleId });
    expect(technologyUpdateSchema.safeParse({
      body: {}, params: { id: id() }, query: {},
    }).success).toBe(false);
    expect(technologyCreateSchema.safeParse({
      body: { code: 'DUP_TECH', name: 'Duplicate', roles: [roleId, roleId] }, query: {},
    }).success).toBe(false);
  });
});
