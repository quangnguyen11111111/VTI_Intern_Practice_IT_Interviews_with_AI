export interface IJobHandler<T = any> {
  readonly name: string;
  handle(data: T): Promise<void>;
}
