import { ClientSession } from "mongoose";
import { IPlan } from "../../models/plan.model";
export interface IPlanRepository {
  findByCode(code: string): Promise<IPlan | null>;
  findById(id: string, session?: ClientSession): Promise<IPlan | null>;
  create(data: Partial<IPlan>): Promise<IPlan>;
}
