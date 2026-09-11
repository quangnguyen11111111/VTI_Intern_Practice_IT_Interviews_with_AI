import { Model, Document, ClientSession } from 'mongoose';
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

  async create(data: Partial<T>, session?: ClientSession): Promise<T> {
    if (!session) return this.model.create(data);
    const created = new this.model(data);
    await created.save({ session });
    return created;
  }

  async update(id: string, data: Partial<T>, session?: ClientSession): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { returnDocument: 'after', session }).exec();
  }

  async softDelete(id: string, session?: ClientSession): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, { status: 'INACTIVE' } as any, { returnDocument: 'after', session }).exec();
  }
}
