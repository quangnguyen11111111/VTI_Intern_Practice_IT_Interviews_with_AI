import { Model, Document } from 'mongoose';
import { IBaseRepository, IFindOptions } from './interfaces/IBaseRepository';

export class BaseRepository<T extends Document> implements IBaseRepository<T> {
  constructor(protected readonly model: Model<T>) {}

  async find(filter: any, options?: IFindOptions): Promise<T[]> {
    let query = this.model.find(filter);
    
    if (options?.populate) {
      query = query.populate(options.populate);
    }
    
    if (options?.sort) {
      query = query.sort(options.sort);
    }

    if (options?.skip !== undefined) {
      query = query.skip(options.skip);
    }

    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    return query.exec();
  }

  async findById(id: string, populate?: any): Promise<T | null> {
    let query = this.model.findById(id);
    if (populate) {
      query = query.populate(populate);
    }
    return query.exec();
  }

  async findOne(filter: any, populate?: any): Promise<T | null> {
    let query = this.model.findOne(filter);
    if (populate) {
      query = query.populate(populate);
    }
    return query.exec();
  }

  async count(filter: any): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  async create(data: Partial<T>): Promise<T> {
    return this.model.create(data);
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async softDelete(id: string): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, { status: 'INACTIVE' } as any, { new: true }).exec();
  }
}
