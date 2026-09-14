import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { AgendaJobScheduler } from '../src/infrastructure/jobs/AgendaJobScheduler';
import { EvaluateAnswersJobHandler } from '../src/domain/jobs/handlers/EvaluateAnswersJobHandler';
import { GenerateQuestionJobHandler } from '../src/domain/jobs/handlers/GenerateQuestionJobHandler';
import {
  interviewJobData,
  operationJobData,
  schedulerJobData,
} from '../src/services/ai/job-security';

const INTERVIEW_ID = '507f1f77bcf86cd799439011';
const OWNER_ID = '507f1f77bcf86cd799439012';
const OPERATION_ID = '507f1f77bcf86cd799439013';

describe('interview generation production-path regressions', () => {
  it('accepts the operation payload emitted by OutboxDispatcher at the Agenda boundary', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockReturnValue({ save });
    const scheduler = new AgendaJobScheduler({} as any);
    (scheduler as any).agenda = { create };
    scheduler.registerHandler({ name: 'GENERATE_QUESTIONS', handle: vi.fn() } as any);

    await scheduler.enqueue('GENERATE_QUESTIONS', { operationId: OPERATION_ID });

    expect(create).toHaveBeenCalledWith(
      'GENERATE_QUESTIONS',
      expect.objectContaining({ operationId: OPERATION_ID }),
    );
    expect(save).toHaveBeenCalledOnce();
  });

  it('keeps owner-scoped jobs strict while accepting operation jobs', () => {
    expect(interviewJobData({ interviewId: INTERVIEW_ID, ownerId: OWNER_ID })).toEqual({
      interviewId: INTERVIEW_ID,
      ownerId: OWNER_ID,
    });
    expect(operationJobData({ operationId: OPERATION_ID })).toEqual({
      operationId: OPERATION_ID,
    });
    expect(operationJobData({ operationId: OPERATION_ID, requestId: null })).toEqual({
      operationId: OPERATION_ID,
      requestId: null,
    });
    expect(schedulerJobData({ operationId: OPERATION_ID })).toEqual({
      operationId: OPERATION_ID,
    });

    expect(() => interviewJobData({ operationId: OPERATION_ID })).toThrowError(
      expect.objectContaining({ code: 'JOB_INPUT_INVALID' }),
    );
    expect(() => schedulerJobData({ operationId: OPERATION_ID, interviewId: INTERVIEW_ID })).toThrowError(
      expect.objectContaining({ code: 'JOB_INPUT_INVALID' }),
    );
  });

  it('validates operation metadata before both durable processors are invoked', async () => {
    const processor = { process: vi.fn().mockResolvedValue(undefined) };
    const generateHandler = new GenerateQuestionJobHandler(processor as any);
    const evaluateHandler = new EvaluateAnswersJobHandler(processor as any);

    await generateHandler.handle({ operationId: OPERATION_ID, requestId: null });
    await evaluateHandler.handle({ operationId: OPERATION_ID, requestId: null });

    expect(processor.process).toHaveBeenNthCalledWith(1, OPERATION_ID, 'GENERATE_QUESTIONS');
    expect(processor.process).toHaveBeenNthCalledWith(2, OPERATION_ID, 'SUBMIT_ANSWERS');
    await expect(generateHandler.handle({ operationId: 'invalid-operation-id' })).rejects.toMatchObject({
      code: 'JOB_INPUT_INVALID',
    });
    await expect(evaluateHandler.handle({ operationId: 'invalid-operation-id' })).rejects.toMatchObject({
      code: 'JOB_INPUT_INVALID',
    });
  });
});
