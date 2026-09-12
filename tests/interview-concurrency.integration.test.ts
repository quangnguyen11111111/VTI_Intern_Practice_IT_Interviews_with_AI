import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import request from 'supertest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ACCESS_SECRET = 'aip56_access_secret_at_least_32_characters_long';
  process.env.JWT_REFRESH_SECRET = 'aip56_refresh_secret_at_least_32_characters_long';
  process.env.PASSWORD_RESET_SECRET = 'aip56_password_reset_secret_at_least_32_chars';
  process.env.CORS_ALLOWED_ORIGINS = 'https://allowed.example';
});

import app from '../src/app';
import User from '../src/models/user.model';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { OperationRecordModel } from '../src/models/OperationRecord';
import { OutboxEventModel } from '../src/models/OutboxEvent';
import { InterviewSubmissionModel } from '../src/models/InterviewSubmission';
import { InterviewEvaluationResultModel } from '../src/models/InterviewEvaluationResult';
import { UserQuotaLedgerModel } from '../src/models/UserQuotaLedger';
import { ProviderUsageAttemptModel } from '../src/models/ProviderUsageAttempt';
import { generateAuthTokens } from '../src/utils/token';
import { InterviewOperationProcessor } from '../src/services/InterviewOperationProcessor';
import { OutboxDispatcher } from '../src/infrastructure/jobs/OutboxDispatcher';
import { IJobScheduler } from '../src/domain/jobs/IJobScheduler';
import { IEventPublisher } from '../src/domain/events/IEventPublisher';
import {
  ControllableBarrier,
  ScriptedAiProvider,
  evaluationUsage,
  validEvaluation
} from './support/ScriptedAiProvider';

class FakeScheduler implements IJobScheduler {
  jobs: Array<{ name: string; data: { operationId: string } }> = [];
  constructor(private failuresRemaining = 0) {}

  async enqueue<T>(name: string, data: T): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('simulated Agenda publish failure');
    }
    this.jobs.push({ name, data: data as { operationId: string } });
  }
}

class FakeEvents implements IEventPublisher {
  published: Array<{ event: string; payload: any }> = [];
  publish(event: string, payload: any): void { this.published.push({ event, payload }); }
  subscribe(): void {}
  unsubscribe(): void {}
}

let replSet: MongoMemoryReplSet;

const allModels = [
  User,
  InterviewSessionModel,
  InterviewQuestionModel,
  OperationRecordModel,
  OutboxEventModel,
  InterviewSubmissionModel,
  InterviewEvaluationResultModel,
  UserQuotaLedgerModel,
  ProviderUsageAttemptModel
];

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(replSet.getUri());
  await Promise.all(allModels.map((model) => model.init()));
});

afterAll(async () => {
  await mongoose.disconnect();
  await replSet.stop();
});

beforeEach(async () => {
  await Promise.all(allModels.map((model) => model.deleteMany({})));
});

const createOwner = async () => {
  const owner = await User.create({
    email: `aip56-${new mongoose.Types.ObjectId()}@example.com`,
    passwordHash: 'test-only-hash',
    fullName: 'AIP 56 Candidate',
    role: 'CANDIDATE',
    status: 'ACTIVE',
    credentialVersion: 0
  });
  return {
    owner,
    token: generateAuthTokens(owner._id.toString(), 'CANDIDATE').accessToken
  };
};

const createInterview = async (
  ownerId: string,
  status: 'PENDING' | 'IN_PROGRESS' = 'IN_PROGRESS',
  version = 0
) => {
  const interview = await InterviewSessionModel.create({
    userId: ownerId,
    status,
    version,
    rubricVersion: 2,
    submissionVersion: 0,
    setupData: { jobPosition: 'Engineer', level: 'Intern', techStacks: ['TypeScript'] }
  });
  const questions = status === 'IN_PROGRESS'
    ? await InterviewQuestionModel.insertMany(Array.from({ length: 5 }, (_, index) => ({
        sessionId: interview._id,
        order: index + 1,
        difficulty: index < 3 ? 'Easy' : 'Medium',
        content: { en: `Question ${index + 1}`, vi: `Câu hỏi ${index + 1}` },
        answerVersion: version
      })))
    : [];
  return { interview, questions };
};

const submissionBody = (questions: Array<{ _id: unknown }>, expectedVersion = 0) => ({
  expectedVersion,
  answers: questions.map((question, index) => ({
    questionId: String(question._id),
    state: 'ANSWERED',
    candidateAnswer: `Accepted answer ${index + 1}`
  }))
});

const submit = (
  token: string,
  interviewId: string,
  body: ReturnType<typeof submissionBody>,
  key: string
) => request(app)
  .post(`/api/v1/interviews/${interviewId}/submit`)
  .set('Authorization', `Bearer ${token}`)
  .set('Idempotency-Key', key)
  .send(body);

const processor = (provider: ScriptedAiProvider, options: ConstructorParameters<typeof InterviewOperationProcessor>[2] = {}) =>
  new InterviewOperationProcessor(provider, new FakeEvents(), options);

describe('AIP-56 queue, idempotency, and race contracts', () => {
  it('allows exactly one concurrent generate transition and commits exactly five questions', async () => {
    const { owner, token } = await createOwner();
    const { interview } = await createInterview(owner._id.toString(), 'PENDING');
    const calls = ['generate-race-key-0001', 'generate-race-key-0002'].map((key) =>
      request(app)
        .post(`/api/v1/interviews/${interview._id}/generate`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({})
    );
    const responses = await Promise.all(calls);
    expect(
      responses.map((response) => response.status).sort(),
      'Contract violation: concurrent generate must produce one accepted request and one state conflict'
    ).toEqual([202, 409]);
    expect(responses.find((response) => response.status === 409)!.body.code).toBe('STATE_CONFLICT');

    const scheduler = new FakeScheduler();
    const dispatcher = new OutboxDispatcher(scheduler, { batchSize: 5 });
    expect(await dispatcher.dispatchOnce()).toBe(1);
    const provider = new ScriptedAiProvider();
    await processor(provider).process(scheduler.jobs[0].data.operationId, 'GENERATE_QUESTIONS');

    const persisted = await InterviewSessionModel.findById(interview._id).lean();
    expect(persisted).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
    expect(await InterviewQuestionModel.countDocuments({ sessionId: interview._id })).toBe(5);
    expect(await OperationRecordModel.countDocuments()).toBe(1);
    expect(await OutboxEventModel.countDocuments()).toBe(1);
    expect(scheduler.jobs).toHaveLength(1);
    expect(provider.generateCalls).toBe(1);
    expect(await UserQuotaLedgerModel.countDocuments({ status: 'SETTLED' })).toBe(1);
  });

  it('replays two submissions with the same key as one operation, debit, job, and result', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const body = submissionBody(questions);
    const responses = await Promise.all([
      submit(token, interview._id.toString(), body, 'same-submit-key-0001'),
      submit(token, interview._id.toString(), body, 'same-submit-key-0001')
    ]);
    expect(responses.map((response) => response.status)).toEqual([202, 202]);
    expect(new Set(responses.map((response) => response.body.data.operationId)).size).toBe(1);
    expect(await OperationRecordModel.countDocuments()).toBe(1);
    expect(await InterviewSubmissionModel.countDocuments()).toBe(1);
    expect(await UserQuotaLedgerModel.countDocuments()).toBe(1);

    const scheduler = new FakeScheduler();
    expect(await new OutboxDispatcher(scheduler).dispatchOnce()).toBe(1);
    const provider = new ScriptedAiProvider();
    await processor(provider).process(scheduler.jobs[0].data.operationId, 'SUBMIT_ANSWERS');

    expect(scheduler.jobs).toHaveLength(1);
    expect(provider.evaluateCalls).toBe(1);
    expect(await InterviewEvaluationResultModel.countDocuments()).toBe(1);
    expect(await UserQuotaLedgerModel.countDocuments({ status: 'SETTLED' })).toBe(1);
    const replay = await submit(token, interview._id.toString(), body, 'same-submit-key-0001');
    expect(replay.status).toBe(202);
    expect(replay.body.data).toMatchObject({
      operationId: responses[0].body.data.operationId,
      status: 'SUCCEEDED',
      replayed: true
    });
  });

  it('returns one STATE_CONFLICT for different keys targeting the same submission version', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const body = submissionBody(questions);
    const responses = await Promise.all([
      submit(token, interview._id.toString(), body, 'different-submit-key-01'),
      submit(token, interview._id.toString(), body, 'different-submit-key-02')
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([202, 409]);
    expect(responses.find((response) => response.status === 409)!.body.code).toBe('STATE_CONFLICT');
    expect(await OperationRecordModel.countDocuments()).toBe(1);
    expect(await InterviewSubmissionModel.countDocuments()).toBe(1);
    expect(await OutboxEventModel.countDocuments()).toBe(1);
    expect(await UserQuotaLedgerModel.countDocuments()).toBe(1);
  });

  it('keeps an accepted submit snapshot consistent when autosave races and rejects the stale write', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const body = submissionBody(questions);
    const staleDraft = {
      expectedVersion: 0,
      answers: questions.map((question) => ({
        questionId: question._id.toString(),
        candidateAnswer: 'stale draft'
      }))
    };
    const [submitResponse, autosaveResponse] = await Promise.all([
      submit(token, interview._id.toString(), body, 'autosave-submit-key-01'),
      request(app)
        .post(`/api/v1/interviews/${interview._id}/progress`)
        .set('Authorization', `Bearer ${token}`)
        .send(staleDraft)
    ]);

    let accepted = submitResponse;
    if (submitResponse.status === 409) {
      expect(autosaveResponse.status).toBe(200);
      const latest = await InterviewSessionModel.findById(interview._id).lean();
      accepted = await submit(
        token,
        interview._id.toString(),
        submissionBody(questions, latest!.version),
        'autosave-submit-key-02'
      );
    } else {
      expect(autosaveResponse.status).toBe(409);
      expect(autosaveResponse.body.code).toBe('VERSION_CONFLICT');
    }
    expect(accepted.status).toBe(202);

    const staleAfterAcceptance = await request(app)
      .post(`/api/v1/interviews/${interview._id}/progress`)
      .set('Authorization', `Bearer ${token}`)
      .send(staleDraft);
    expect(staleAfterAcceptance.status).toBe(409);
    expect(staleAfterAcceptance.body.code).toBe('VERSION_CONFLICT');
    const snapshot = await InterviewSubmissionModel.findOne({ sessionId: interview._id }).lean();
    expect(snapshot!.answers.map((answer) => answer.candidateAnswer)).toEqual(
      body.answers.map((answer) => answer.candidateAnswer)
    );
    const persistedQuestions = await InterviewQuestionModel.find({ sessionId: interview._id }).sort({ order: 1 }).lean();
    expect(persistedQuestions.map((question) => question.candidateAnswer)).toEqual(
      body.answers.map((answer) => answer.candidateAnswer)
    );
    expect(await OperationRecordModel.countDocuments()).toBe(1);
    expect(await OutboxEventModel.countDocuments()).toBe(1);
  });

  it('atomically claims duplicate Agenda delivery so output, usage, and quota are not multiplied', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const accepted = await submit(token, interview._id.toString(), submissionBody(questions), 'duplicate-job-key-001');
    expect(accepted.status).toBe(202);
    const operationId = accepted.body.data.operationId;
    const barrier = new ControllableBarrier();
    const provider = new ScriptedAiProvider([], [async (providerQuestions) => {
      await barrier.hold();
      return { data: validEvaluation(providerQuestions), audit: evaluationUsage };
    }]);
    const worker = processor(provider);
    const firstDelivery = worker.process(operationId, 'SUBMIT_ANSWERS');
    await barrier.reached;
    await worker.process(operationId, 'SUBMIT_ANSWERS');
    expect(provider.evaluateCalls).toBe(1);
    barrier.release();
    await firstDelivery;

    expect(await InterviewEvaluationResultModel.countDocuments()).toBe(1);
    expect(await ProviderUsageAttemptModel.countDocuments()).toBe(1);
    expect(await UserQuotaLedgerModel.countDocuments({ status: 'SETTLED' })).toBe(1);
    const session = await InterviewSessionModel.findById(interview._id).lean();
    expect(session!.metadata!.totalTokens).toBe(90);
  });

  it('recovers after a crash following the AI call but before commit with one output and correct accounting', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const accepted = await submit(token, interview._id.toString(), submissionBody(questions), 'precommit-crash-key-1');
    expect(accepted.status).toBe(202);
    let nowMs = Date.now() + 1_000;
    let crash = true;
    const provider = new ScriptedAiProvider();
    const scheduler = new FakeScheduler();
    const dispatcher = new OutboxDispatcher(scheduler, {
      now: () => new Date(nowMs),
      redeliveryMs: 100
    });
    expect(await dispatcher.dispatchOnce()).toBe(1);
    const crashingWorker = processor(provider, {
      now: () => new Date(nowMs),
      leaseMs: 100,
      hooks: { afterProviderBeforeCommit: () => {
        if (crash) { crash = false; throw new Error('simulated worker crash before commit'); }
      } }
    });
    await expect(crashingWorker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS')).rejects.toThrow('simulated worker crash');
    expect(await InterviewEvaluationResultModel.countDocuments()).toBe(0);

    nowMs += 101;
    expect(await dispatcher.dispatchOnce()).toBe(1);
    expect(scheduler.jobs).toHaveLength(2);
    const restartedWorker = processor(provider, { now: () => new Date(nowMs), leaseMs: 100 });
    await restartedWorker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');
    expect(provider.evaluateCalls).toBe(2);
    expect(await InterviewEvaluationResultModel.countDocuments()).toBe(1);
    expect(await ProviderUsageAttemptModel.countDocuments({ status: 'UNKNOWN' })).toBe(1);
    expect(await ProviderUsageAttemptModel.countDocuments({ status: 'SUCCEEDED' })).toBe(1);
    expect(await ProviderUsageAttemptModel.findOne({ status: 'UNKNOWN' }).lean())
      .toMatchObject({ usage: { totalTokens: evaluationUsage.totalTokenCount } });
    expect(await UserQuotaLedgerModel.countDocuments({ status: 'SETTLED' })).toBe(1);
    expect((await InterviewSessionModel.findById(interview._id).lean())!.metadata!.totalTokens).toBe(90);
  });

  it('keeps the outbox event durable when Agenda publish fails and publishes it once available', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const accepted = await submit(
      token,
      interview._id.toString(),
      submissionBody(questions),
      'outbox-publish-retry-key-1'
    );
    expect(accepted.status).toBe(202);

    let nowMs = Date.now() + 1_000;
    const scheduler = new FakeScheduler(1);
    const dispatcher = new OutboxDispatcher(scheduler, {
      now: () => new Date(nowMs),
      random: () => 0
    });
    expect(await dispatcher.dispatchOnce()).toBe(0);
    const retrying = await OutboxEventModel.findOne({ operationId: accepted.body.data.operationId }).lean();
    expect(retrying).toMatchObject({
      status: 'PENDING',
      safeErrorCode: 'QUEUE_PUBLISH_RETRY',
      attempts: 1
    });
    expect(retrying!.nextAttemptAt.getTime() - nowMs).toBe(500);

    nowMs += 500;
    expect(await dispatcher.dispatchOnce()).toBe(1);
    expect(scheduler.jobs).toHaveLength(1);
    expect(await OutboxEventModel.findOne({ operationId: accepted.body.data.operationId }).lean())
      .toMatchObject({ status: 'PUBLISHED', attempts: 2 });
    expect(await OperationRecordModel.findById(accepted.body.data.operationId).lean())
      .toMatchObject({ status: 'PENDING', attempts: 0 });
  });

  it('no-ops redelivery after DB commit when the worker crashes before queue acknowledgement', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const accepted = await submit(token, interview._id.toString(), submissionBody(questions), 'postcommit-crash-key1');
    expect(accepted.status).toBe(202);
    const provider = new ScriptedAiProvider();
    const crashingWorker = processor(provider, {
      hooks: { afterCommitBeforeAck: () => { throw new Error('simulated crash before ack'); } }
    });
    await expect(crashingWorker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS')).rejects.toThrow('simulated crash');
    await processor(provider).process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');

    expect(provider.evaluateCalls).toBe(1);
    expect(await InterviewEvaluationResultModel.countDocuments()).toBe(1);
    expect(await ProviderUsageAttemptModel.countDocuments()).toBe(1);
    expect((await OperationRecordModel.findById(accepted.body.data.operationId).lean())!.status).toBe('SUCCEEDED');
  });

  it.each([
    ['429', Object.assign(new Error('rate limited'), { status: 429 }), 'AI_RATE_LIMITED'],
    ['timeout', Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }), 'AI_TIMEOUT'],
    ['5xx', Object.assign(new Error('upstream unavailable'), { status: 503 }), 'AI_DEPENDENCY_UNAVAILABLE']
  ])('durably retries a provider %s with bounded jitter and preserves the accepted request', async (_label, failure, safeCode) => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const accepted = await submit(token, interview._id.toString(), submissionBody(questions), `retry-${_label}-key-0001`);
    expect(accepted.status).toBe(202);
    let nowMs = Date.now() + 1_000;
    const scheduler = new FakeScheduler();
    const dispatcher = new OutboxDispatcher(scheduler, { now: () => new Date(nowMs), random: () => 0.5 });
    await dispatcher.dispatchOnce();
    const provider = new ScriptedAiProvider([], [failure]);
    const worker = processor(provider, {
      now: () => new Date(nowMs),
      random: () => 0.5,
      baseRetryMs: 100,
      maxRetryMs: 1_000,
      maxAttempts: 3
    });
    await worker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');

    const pending = await OperationRecordModel.findById(accepted.body.data.operationId).lean();
    expect(pending).toMatchObject({ status: 'PENDING', safeErrorCode: safeCode, attempts: 1 });
    expect(pending!.nextAttemptAt.getTime() - nowMs).toBe(150);
    expect((await InterviewSessionModel.findById(interview._id).lean())!.status).toBe('EVALUATING');
    expect(await InterviewSubmissionModel.countDocuments()).toBe(1);

    nowMs += 150;
    expect(await dispatcher.dispatchOnce()).toBe(1);
    await worker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');
    expect(provider.evaluateCalls).toBe(2);
    expect(scheduler.jobs).toHaveLength(2);
    expect(await InterviewEvaluationResultModel.countDocuments()).toBe(1);
    expect(await UserQuotaLedgerModel.countDocuments({ status: 'SETTLED' })).toBe(1);
  });

  it('stops retrying at the configured bound and releases the reserved user quota', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const accepted = await submit(
      token,
      interview._id.toString(),
      submissionBody(questions),
      'retry-exhaustion-key-0001'
    );
    expect(accepted.status).toBe(202);

    let nowMs = Date.now() + 1_000;
    const failures = Array.from({ length: 3 }, () => Object.assign(
      new Error('upstream unavailable'),
      { status: 503 }
    ));
    const provider = new ScriptedAiProvider([], failures);
    const worker = processor(provider, {
      now: () => new Date(nowMs),
      random: () => 0,
      baseRetryMs: 100,
      maxRetryMs: 1_000,
      maxAttempts: 3
    });

    await worker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');
    nowMs += 100;
    await worker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');
    nowMs += 200;
    await worker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');
    await worker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');

    expect(provider.evaluateCalls).toBe(3);
    expect(await ProviderUsageAttemptModel.countDocuments()).toBe(3);
    expect(await InterviewEvaluationResultModel.countDocuments()).toBe(0);
    expect(await OperationRecordModel.findById(accepted.body.data.operationId).lean()).toMatchObject({
      status: 'FAILED',
      safeErrorCode: 'AI_RETRY_EXHAUSTED',
      attempts: 3
    });
    expect(await UserQuotaLedgerModel.findOne({ operationId: accepted.body.data.operationId }).lean())
      .toMatchObject({ status: 'RELEASED' });
    expect(await InterviewSessionModel.findById(interview._id).lean()).toMatchObject({
      status: 'FAILED',
      safeErrorCode: 'AI_RETRY_EXHAUSTED'
    });
  });

  it('turns invalid provider JSON/schema into a safe terminal failure without infinite retry', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const accepted = await submit(token, interview._id.toString(), submissionBody(questions), 'invalid-output-key-001');
    expect(accepted.status).toBe(202);
    const provider = new ScriptedAiProvider([], [{
      data: { evaluations: [] } as any,
      audit: evaluationUsage
    }]);
    const worker = processor(provider);
    await worker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');
    await worker.process(accepted.body.data.operationId, 'SUBMIT_ANSWERS');

    expect(provider.evaluateCalls).toBe(1);
    expect(await InterviewEvaluationResultModel.countDocuments()).toBe(0);
    expect(await OperationRecordModel.findById(accepted.body.data.operationId).lean()).toMatchObject({
      status: 'FAILED',
      safeErrorCode: 'AI_OUTPUT_INVALID',
      attempts: 1
    });
    expect(await InterviewSessionModel.findById(interview._id).lean()).toMatchObject({
      status: 'FAILED',
      safeErrorCode: 'AI_OUTPUT_INVALID'
    });
    expect(await OutboxEventModel.countDocuments({ status: 'FAILED' })).toBe(1);
    expect(await ProviderUsageAttemptModel.findOne({ operationId: accepted.body.data.operationId }).lean())
      .toMatchObject({ status: 'FAILED', usage: { totalTokens: evaluationUsage.totalTokenCount } });
    expect(await UserQuotaLedgerModel.findOne({ operationId: accepted.body.data.operationId }).lean())
      .toMatchObject({ status: 'RELEASED' });
  });

  it('returns IDEMPOTENCY_CONFLICT for the same key with a different fingerprint and adds no effect', async () => {
    const { owner, token } = await createOwner();
    const { interview, questions } = await createInterview(owner._id.toString());
    const body = submissionBody(questions);
    const key = 'fingerprint-conflict-key-01';
    const accepted = await submit(token, interview._id.toString(), body, key);
    expect(accepted.status).toBe(202);
    const changed = structuredClone(body);
    changed.answers[0].candidateAnswer = 'Different answer';
    const conflict = await submit(token, interview._id.toString(), changed, key);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await OperationRecordModel.countDocuments()).toBe(1);
    expect(await InterviewSubmissionModel.countDocuments()).toBe(1);
    expect(await OutboxEventModel.countDocuments()).toBe(1);
    expect(await UserQuotaLedgerModel.countDocuments()).toBe(1);
  });
});
