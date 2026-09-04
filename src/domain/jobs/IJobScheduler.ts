export interface IJobScheduler {
  enqueue<T>(jobName: string, data: T, options?: any): Promise<void>;
}
