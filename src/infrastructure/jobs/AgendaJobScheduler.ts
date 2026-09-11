import { Agenda, Job } from 'agenda';
import mongoose from 'mongoose';
import { IJobScheduler } from '../../domain/jobs/IJobScheduler';
import { IJobHandler } from '../../domain/jobs/IJobHandler';
import { inject, singleton } from 'tsyringe';
import { AppEnv } from '../../config/env';
import { logger, logContext } from '../logging/logger';

@singleton()
export class AgendaJobScheduler implements IJobScheduler {
  private agenda!: Agenda;
  private handlers = new Map<string, IJobHandler>();
  private isStarted = false;

  constructor(@inject('AppEnv') private readonly env: AppEnv) {
    // Agenda will be instantiated in start() because it requires mongo connection
  }

  public registerHandler(handler: IJobHandler): void {
    this.handlers.set(handler.name, handler);
  }

  public async start(): Promise<void> {
    if (this.isStarted) return;
    
    // Make sure we wait for mongoose to be connected before starting agenda
    if (mongoose.connection.readyState !== 1) {
      logger.warn('scheduler.waiting');
      await new Promise(resolve => mongoose.connection.once('open', resolve));
    }
    
    // In newer agenda versions, you pass mongo instance via options in constructor or db config.
    // If it requires mongo instance after construction, we can recreate it here since handlers are just definitions.
    // Actually, agenda can just be re-initialized if needed. But let's try calling agenda.database() or pass it directly.
    this.agenda = new Agenda({
      db: { 
        address: this.env.MONGODB_URI,
        collection: 'agendaJobs'
      },
      disableAutoIndex: this.env.NODE_ENV === 'production',
    });
    
    // Re-register handlers
    for (const handler of this.handlers.values()) {
      this.agenda.define(handler.name, async (job: Job) => {
        return logContext.run({ requestId: job.attrs.data?.requestId }, async () => {
          logger.info('job.started', { jobName: handler.name, attempt: (job.attrs.failCount ?? 0) + 1 });
          try {
            await handler.handle(job.attrs.data);
            logger.info('job.completed', { jobName: handler.name });
          } catch {
            logger.error('job.failed', { jobName: handler.name });
            // Agenda persists failReason: never let it store a provider message or stack.
            throw new Error('JOB_EXECUTION_FAILED');
          }
        });
      });
    }

    await this.agenda.start();
    this.isStarted = true;
    logger.info('scheduler.started');
  }

  public async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.agenda.stop();
    this.isStarted = false;
    logger.info('scheduler.stopped');
  }

  public async enqueue<T>(jobName: string, data: T, options?: any): Promise<void> {
    if (!this.handlers.has(jobName)) {
      throw new Error(`Job handler for ${jobName} not registered`);
    }
    
    const job = this.agenda.create(jobName, { ...data, requestId: logContext.getStore()?.requestId });
    await job.save();
    logger.info('job.queued', { jobName });
  }
}
