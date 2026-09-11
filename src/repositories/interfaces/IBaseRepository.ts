export interface IFindOptions {
  skip?: number;
  limit?: number;
  sort?: any;
  populate?: any;
}

export interface IBaseRepository<T> {
  find(filter: any, options?: IFindOptions): Promise<T[]>;
  findById(id: string, populate?: any): Promise<T | null>;
  findOne(filter: any, populate?: any): Promise<T | null>;
  count(filter: any): Promise<number>;
  create(data: Partial<T>, session?: ClientSession): Promise<T>;
  update(id: string, data: Partial<T>, session?: ClientSession): Promise<T | null>;
  softDelete(id: string, session?: ClientSession): Promise<T | null>;
}
import { ClientSession } from 'mongoose';
