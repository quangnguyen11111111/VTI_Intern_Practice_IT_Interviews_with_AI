import { randomUUID } from 'node:crypto';
import { inject, singleton } from 'tsyringe';
import { IJobScheduler } from '../../domain/jobs/IJobScheduler';
import { OutboxEventModel } from '../../models/OutboxEvent';
import { OperationRecordModel } from '../../models/OperationRecord';

export interface OutboxDispatcherOptions {
  now?: () => Date;
  random?: () => number;
  leaseMs?: number;
  batchSize?: number;
  pollMs?: number;
  maxAttempts?: number;
  redeliveryMs?: number;
}

@singleton()
export class OutboxDispatcher {
  private timer?: NodeJS.Timeout;
  private dispatching = false;
  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly leaseMs: number;
  private readonly batchSize: number;
  private readonly pollMs: number;
  private readonly maxAttempts: number;
  private readonly redeliveryMs: number;

  constructor(
    @inject('IJobScheduler') private readonly scheduler: IJobScheduler,
    @inject('OutboxDispatcherOptions') options: OutboxDispatcherOptions = {}
  ) {
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.leaseMs = options.leaseMs ?? 30_000;
    this.batchSize = options.batchSize ?? 20;
    this.pollMs = options.pollMs ?? 1_000;
    this.maxAttempts = options.maxAttempts ?? 10;
    this.redeliveryMs = options.redeliveryMs ?? 60_000;
  }

  async dispatchOnce(): Promise<number> {
    await this.recoverStalledPublications();
    let published = 0;
    for (let index = 0; index < this.batchSize; index += 1) {
      const now = this.now();
      const leaseToken = randomUUID();
      const event = await OutboxEventModel.findOneAndUpdate(
        {
          nextAttemptAt: { $lte: now },
          $or: [
            { status: 'PENDING' },
            { status: 'LEASED', leasedUntil: { $lte: now } }
          ]
        },
        {
          $set: {
            status: 'LEASED',
            leaseToken,
            leasedUntil: new Date(now.getTime() + this.leaseMs)
          },
          $inc: { attempts: 1 }
        },
        { sort: { nextAttemptAt: 1 }, returnDocument: 'after' }
      );
      if (!event) break;

      try {
        const jobName = event.eventType === 'INTERVIEW_GENERATION_REQUESTED'
          ? 'GENERATE_QUESTIONS'
          : 'EVALUATE_ANSWERS';
        await this.scheduler.enqueue(jobName, { operationId: event.operationId.toString() });
        await OutboxEventModel.updateOne(
          { _id: event._id, status: 'LEASED', leaseToken },
          {
            $set: { status: 'PUBLISHED', publishedAt: this.now(), safeErrorCode: null },
            $unset: { leaseToken: 1, leasedUntil: 1 }
          }
        );
        published += 1;
      } catch {
        const terminal = event.attempts >= this.maxAttempts;
        const backoff = Math.min(30_000, 500 * (2 ** Math.max(0, event.attempts - 1)));
        const nextAttemptAt = new Date(
          this.now().getTime() + backoff + Math.floor(this.random() * 500)
        );
        await OutboxEventModel.updateOne(
          { _id: event._id, status: 'LEASED', leaseToken },
          {
            $set: {
              status: terminal ? 'FAILED' : 'PENDING',
              safeErrorCode: terminal ? 'QUEUE_PUBLISH_FAILED' : 'QUEUE_PUBLISH_RETRY',
              nextAttemptAt
            },
            $unset: { leaseToken: 1, leasedUntil: 1 }
          }
        );
      }
    }
    return published;
  }

  private async recoverStalledPublications(): Promise<void> {
    const now = this.now();
    const staleBefore = new Date(now.getTime() - this.redeliveryMs);
    const stalledOperations = await OperationRecordModel.find({
      $or: [
        { status: 'PENDING', nextAttemptAt: { $lte: now } },
        { status: 'PROCESSING', leaseExpiresAt: { $lte: now } }
      ]
    })
      .select('_id')
      .limit(this.batchSize)
      .lean();
    if (stalledOperations.length === 0) return;

    await OutboxEventModel.updateMany(
      {
        operationId: { $in: stalledOperations.map((operation) => operation._id) },
        status: 'PUBLISHED',
        publishedAt: { $lte: staleBefore }
      },
      {
        $set: {
          status: 'PENDING',
          safeErrorCode: 'QUEUE_REDELIVERY',
          nextAttemptAt: now
        },
        $unset: { leaseToken: 1, leasedUntil: 1 }
      }
    );
  }

  async start(): Promise<void> {
    if (this.timer) return;
    await this.runSafely();
    this.timer = setInterval(() => void this.runSafely(), this.pollMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private async runSafely(): Promise<void> {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      await this.dispatchOnce();
    } finally {
      this.dispatching = false;
    }
  }
}
