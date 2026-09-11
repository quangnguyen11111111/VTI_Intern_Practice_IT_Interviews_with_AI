import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { InterviewContext } from '../src/domain/interview/InterviewContext';
import { IInterviewState, InterviewStatus } from '../src/domain/interview/IInterviewState';
import { PendingState } from '../src/domain/interview/states/PendingState';
import { GeneratingState } from '../src/domain/interview/states/GeneratingState';
import { InProgressState } from '../src/domain/interview/states/InProgressState';
import { EvaluatingState } from '../src/domain/interview/states/EvaluatingState';
import { CompletedState } from '../src/domain/interview/states/CompletedState';
import { FailedState } from '../src/domain/interview/states/FailedState';
import { MongoInterviewRepository } from '../src/repositories/MongoInterviewRepository';
import { InterviewSessionModel } from '../src/models/InterviewSession';
import { InterviewQuestionModel } from '../src/models/InterviewQuestion';
import { createInterviewSessionFixture } from './fixtures/aip55.factories';

let mongo: MongoMemoryServer;

const repositoryFor = (session: { userId: string }): MongoInterviewRepository =>
  new MongoInterviewRepository(session.userId);

const statuses: InterviewStatus[] = [
  'PENDING',
  'GENERATING',
  'IN_PROGRESS',
  'EVALUATING',
  'COMPLETED',
  'FAILED',
];

const allowed: Record<InterviewStatus, InterviewStatus[]> = {
  PENDING: ['GENERATING'],
  GENERATING: ['IN_PROGRESS', 'FAILED'],
  IN_PROGRESS: ['EVALUATING', 'FAILED'],
  EVALUATING: ['COMPLETED', 'FAILED'],
  COMPLETED: [],
  FAILED: ['GENERATING', 'EVALUATING'],
};

const stateFor = (status: InterviewStatus): IInterviewState => {
  switch (status) {
    case 'PENDING': return new PendingState();
    case 'GENERATING': return new GeneratingState();
    case 'IN_PROGRESS': return new InProgressState();
    case 'EVALUATING': return new EvaluatingState();
    case 'COMPLETED': return new CompletedState();
    case 'FAILED': return new FailedState();
  }
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri('aip55_state_machine'));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    InterviewSessionModel.deleteMany({}),
    InterviewQuestionModel.deleteMany({}),
  ]);
});

describe('AIP-55 interview state-machine persistence', () => {
  it('persists every normal legal transition and increments version exactly once', async () => {
    const session = await createInterviewSessionFixture();
    const context = new InterviewContext(
      session._id.toString(),
      repositoryFor(session),
      new PendingState(),
      undefined,
      0
    );

    const path: InterviewStatus[] = ['GENERATING', 'IN_PROGRESS', 'EVALUATING', 'COMPLETED'];
    for (const [index, status] of path.entries()) {
      await context.changeState(stateFor(status));
      const persisted = await InterviewSessionModel.findById(session._id).lean();
      expect(
        { status: persisted?.status, version: persisted?.version },
        `AIP-55 contract: ${path[index - 1] ?? 'PENDING'} -> ${status} must persist atomically`
      ).toEqual({ status, version: index + 1 });
    }
  });

  it('persists failure and both supported recovery transitions', async () => {
    const generationFailure = await createInterviewSessionFixture({ status: 'GENERATING' });
    const generationContext = new InterviewContext(
      generationFailure._id.toString(), repositoryFor(generationFailure), new GeneratingState(), undefined, 0
    );
    await generationContext.changeState(new FailedState());
    await generationContext.changeState(new GeneratingState());

    const evaluationFailure = await createInterviewSessionFixture({ status: 'EVALUATING' });
    const evaluationContext = new InterviewContext(
      evaluationFailure._id.toString(), repositoryFor(evaluationFailure), new EvaluatingState(), undefined, 0
    );
    await evaluationContext.changeState(new FailedState());
    await evaluationContext.changeState(new EvaluatingState());

    expect(await InterviewSessionModel.findById(generationFailure._id).lean()).toMatchObject({
      status: 'GENERATING',
      version: 2,
    });
    expect(await InterviewSessionModel.findById(evaluationFailure._id).lean()).toMatchObject({
      status: 'EVALUATING',
      version: 2,
    });
  });

  it('routes generate and submit actions through their legal transitions without external AI calls', async () => {
    const scheduler = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const pending = await createInterviewSessionFixture();
    const pendingContext = new InterviewContext(
      pending._id.toString(), repositoryFor(pending), new PendingState(), undefined, 0
    );
    await pendingContext.generate({ setupData: {}, jobScheduler: scheduler });

    const inProgress = await createInterviewSessionFixture({ status: 'IN_PROGRESS' });
    const inProgressContext = new InterviewContext(
      inProgress._id.toString(), repositoryFor(inProgress), new InProgressState(), undefined, 0
    );
    await inProgressContext.submit({ data: [], jobScheduler: scheduler });

    expect(await InterviewSessionModel.findById(pending._id).lean()).toMatchObject({
      status: 'GENERATING',
      version: 1,
    });
    expect(await InterviewSessionModel.findById(inProgress._id).lean()).toMatchObject({
      status: 'EVALUATING',
      version: 1,
    });
    expect(scheduler.enqueue).toHaveBeenCalledTimes(2);
  });

  it('routes both FAILED recovery actions and rejects every state-specific illegal action', async () => {
    const scheduler = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const failedGeneration = await createInterviewSessionFixture({ status: 'FAILED' });
    const failedSubmission = await createInterviewSessionFixture({ status: 'FAILED' });
    await new InterviewContext(
      failedGeneration._id.toString(), repositoryFor(failedGeneration), new FailedState(), undefined, 0
    ).generate({ setupData: {}, jobScheduler: scheduler });
    await new InterviewContext(
      failedSubmission._id.toString(), repositoryFor(failedSubmission), new FailedState(), undefined, 0
    ).submit({ data: [], jobScheduler: scheduler });

    const illegalActions: Record<InterviewStatus, Array<'generate' | 'submit' | 'saveProgress'>> = {
      PENDING: ['submit', 'saveProgress'],
      GENERATING: ['generate', 'submit', 'saveProgress'],
      IN_PROGRESS: ['generate'],
      EVALUATING: ['generate', 'submit', 'saveProgress'],
      COMPLETED: ['generate', 'submit', 'saveProgress'],
      FAILED: ['saveProgress'],
    };

    for (const status of statuses) {
      for (const action of illegalActions[status]) {
        const session = await createInterviewSessionFixture({ status });
        const context = new InterviewContext(
          session._id.toString(), repositoryFor(session), stateFor(status), undefined, 0
        );
        const operation = action === 'generate'
          ? context.generate({ setupData: {}, jobScheduler: scheduler })
          : action === 'submit'
            ? context.submit({ data: [], jobScheduler: scheduler })
            : context.saveProgress({ answers: [] });

        await expect(
          operation,
          `AIP-55 contract: ${action} is illegal while interview is ${status}`
        ).rejects.toMatchObject({ statusCode: 409, code: 'STATE_CONFLICT' });
        expect(await InterviewSessionModel.findById(session._id).lean()).toMatchObject({
          status,
          version: 0,
        });
      }
    }

    expect(await InterviewSessionModel.findById(failedGeneration._id).lean()).toMatchObject({
      status: 'GENERATING',
      version: 1,
    });
    expect(await InterviewSessionModel.findById(failedSubmission._id).lean()).toMatchObject({
      status: 'EVALUATING',
      version: 1,
    });
  });

  it('rejects every illegal transition without changing database status or version', async () => {
    for (const from of statuses) {
      for (const to of statuses.filter((candidate) => !allowed[from].includes(candidate))) {
        const session = await createInterviewSessionFixture({ status: from });
        const context = new InterviewContext(
          session._id.toString(), repositoryFor(session), stateFor(from), undefined, 0
        );

        await expect(
          context.changeState(stateFor(to)),
          `AIP-55 contract: illegal transition ${from} -> ${to} must be rejected`
        ).rejects.toMatchObject({ statusCode: 409, code: 'STATE_CONFLICT' });

        const persisted = await InterviewSessionModel.findById(session._id).lean();
        expect(
          { status: persisted?.status, version: persisted?.version },
          `AIP-55 contract: rejected ${from} -> ${to} must have no database side effect`
        ).toEqual({ status: from, version: 0 });
      }
    }
  });

  it('rejects a stale version and preserves the newer database state', async () => {
    const session = await createInterviewSessionFixture({ status: 'PENDING', version: 1 });
    const staleContext = new InterviewContext(
      session._id.toString(), repositoryFor(session), new PendingState(), undefined, 0
    );

    await expect(staleContext.changeState(new GeneratingState())).rejects.toMatchObject({
      statusCode: 409,
      code: 'STATE_CONFLICT',
    });

    expect(
      await InterviewSessionModel.findById(session._id).lean(),
      'AIP-55 contract: stale writers must not overwrite the database'
    ).toMatchObject({ status: 'PENDING', version: 1 });
  });

  it('allows exactly one concurrent transition winner and verifies final database state', async () => {
    const session = await createInterviewSessionFixture();
    const contexts = [1, 2].map(() => new InterviewContext(
      session._id.toString(), repositoryFor(session), new PendingState(), undefined, 0
    ));

    const results = await Promise.allSettled(
      contexts.map((context) => context.changeState(new GeneratingState()))
    );
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    const persisted = await InterviewSessionModel.findById(session._id).lean();

    expect(fulfilled, 'AIP-55 contract: CAS must produce exactly one transition winner').toHaveLength(1);
    expect(rejected, 'AIP-55 contract: CAS must reject the concurrent stale writer').toHaveLength(1);
    expect(rejected[0]).toMatchObject({
      reason: expect.objectContaining({ statusCode: 409, code: 'STATE_CONFLICT' }),
    });
    expect(
      { status: persisted?.status, version: persisted?.version },
      'AIP-55 contract: concurrent transition final DB state must contain one version increment'
    ).toEqual({ status: 'GENERATING', version: 1 });
  });
});
