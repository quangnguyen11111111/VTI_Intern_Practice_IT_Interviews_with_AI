import { injectable } from 'tsyringe';
import { ClientSession } from 'mongoose';
import Plan, { IPlan } from '../models/plan.model';
import { IPlanRepository } from './interfaces/IPlanRepository';

@injectable()
export class PlanRepository implements IPlanRepository {
  findByCode(code: string): Promise<IPlan | null> {
    return Plan.findOne({ code: code.toUpperCase() });
  }

  findById(id: string, session?: ClientSession): Promise<IPlan | null> {
    return Plan.findById(id).session(session ?? null);
  }

  create(data: Partial<IPlan>): Promise<IPlan> {
    return Plan.create(data).then((plan) => plan);
  }
}