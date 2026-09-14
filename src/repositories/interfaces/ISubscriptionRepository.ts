import { ClientSession } from "mongoose";
import { ISubscription } from "../../models/subscription.model";
export interface ISubscriptionRepository {
  create(
    data: Partial<ISubscription>,
    session?: ClientSession,
  ): Promise<ISubscription>;
  findActiveByUserAndPlan(
    userId: string,
    planId: string,
    session?: ClientSession,
  ): Promise<ISubscription | null>;
  extendActive(
    id: string,
    expiresAt: Date,
    session?: ClientSession,
  ): Promise<ISubscription | null>;
  createOrExtendActive(
    userId: string,
    planId: string,
    durationDays: number,
    now: Date,
    session?: ClientSession,
  ): Promise<ISubscription | null>;
}
