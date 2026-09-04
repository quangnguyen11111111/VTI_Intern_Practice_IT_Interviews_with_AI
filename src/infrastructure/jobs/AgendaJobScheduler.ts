import { Agenda, Job } from 'agenda';
import mongoose from 'mongoose';
import { IJobScheduler } from '../../domain/jobs/IJobScheduler';
import { IJobHandler } from '../../domain/jobs/IJobHandler';
import { singleton } from 'tsyringe';

@singleton()
export class AgendaJobScheduler implements IJobScheduler {
  private agenda!: Agenda;
  private handlers = new Map<string, IJobHandler>();
  private isStarted = false;

  constructor() {
    // Agenda will be instantiated in start() because it requires mongo connection
  }

  public registerHandler(handler: IJobHandler): void {
    this.handlers.set(handler.name, handler);
  }

  public async start(): Promise<void> {
    if (this.isStarted) return;
    
    // Make sure we wait for mongoose to be connected before starting agenda
    if (mongoose.connection.readyState !== 1) {
      console.warn('[Agenda] Mongoose not connected yet, waiting...');
      await new Promise(resolve => mongoose.connection.once('open', resolve));
    }
    
    // In newer agenda versions, you pass mongo instance via options in constructor or db config.
    // If it requires mongo instance after construction, we can recreate it here since handlers are just definitions.
    // Actually, agenda can just be re-initialized if needed. But let's try calling agenda.database() or pass it directly.
    this.agenda = new Agenda({
      db: { 
        address: process.env.MONGODB_URI || 'mongodb://localhost:27017/it-interview-ai',
        collection: 'agendaJobs'
      }
    });
    
    // Re-register handlers
    for (const handler of this.handlers.values()) {
      this.agenda.define(handler.name, async (job: Job) => {
        console.log(`[Agenda] Starting job: ${handler.name}`);
        try {
          await handler.handle(job.attrs.data);
          console.log(`[Agenda] Job completed: ${handler.name}`);
        } catch (error) {
          console.error(`[Agenda] Job failed: ${handler.name}`, error);
          throw error;
        }
      });
    }

    await this.agenda.start();
    this.isStarted = true;
    console.log('[Agenda] Background Job Scheduler started.');
  }

  public async stop(): Promise<void> {
    if (!this.isStarted) return;
    await this.agenda.stop();
    this.isStarted = false;
    console.log('[Agenda] Background Job Scheduler stopped.');
  }

  public async enqueue<T>(jobName: string, data: T, options?: any): Promise<void> {
    if (!this.handlers.has(jobName)) {
      throw new Error(`Job handler for ${jobName} not registered`);
    }
    
    const job = this.agenda.create(jobName, data as any);
    await job.save();
    console.log(`[Agenda] Queued job: ${jobName}`);
  }
}
