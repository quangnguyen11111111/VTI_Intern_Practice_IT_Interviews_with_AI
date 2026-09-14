import mongoose, { ClientSession } from 'mongoose';
import { IEntitlement } from '../../models/entitlement.model';

export interface IEntitlementRepository {
  findActive(
    userId: string,
    key: string,
    session?: ClientSession,
  ): Promise<IEntitlement | null>;

  create(
    data: Partial<IEntitlement>,
    session?: ClientSession,
  ): Promise<IEntitlement>;

  extendActive(
    id: string,
    subscriptionId: mongoose.Types.ObjectId,
    validUntil: Date,
    session?: ClientSession,
  ): Promise<IEntitlement | null>;

  createOrExtendActive(
    userId: string,
    key: string,
    subscriptionId: mongoose.Types.ObjectId,
    validUntil: Date,
    now: Date,
    session?: ClientSession,
  ): Promise<IEntitlement | null>;
}