import { injectable } from 'tsyringe';
import mongoose, { ClientSession } from 'mongoose';
import Entitlement, { IEntitlement } from '../models/entitlement.model';
import { IEntitlementRepository } from './interfaces/IEntitlementRepository';

@injectable()
export class EntitlementRepository implements IEntitlementRepository {
  findActive(
    userId: string,
    key: string,
    session?: ClientSession,
  ): Promise<IEntitlement | null> {
    return Entitlement.findOne({
      userId,
      entitlementKey: key,
      status: 'ACTIVE',
    }).session(session ?? null);
  }

  async create(
    data: Partial<IEntitlement>,
    session?: ClientSession,
  ): Promise<IEntitlement> {
    const doc = new Entitlement(data);
    await doc.save({ session });
    return doc;
  }

  extendActive(
    id: string,
    subscriptionId: mongoose.Types.ObjectId,
    validUntil: Date,
    session?: ClientSession,
  ): Promise<IEntitlement | null> {
    return Entitlement.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        status: 'ACTIVE',
      },
      {
        $set: {
          subscriptionId,
          validUntil,
        },
      },
      {
        returnDocument: 'after',
        session,
      },
    );
  }

  createOrExtendActive(
    userId: string,
    key: string,
    subscriptionId: mongoose.Types.ObjectId,
    validUntil: Date,
    now: Date,
    session?: ClientSession,
  ): Promise<IEntitlement | null> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    return Entitlement.findOneAndUpdate(
      {
        userId: userObjectId,
        entitlementKey: key,
        status: 'ACTIVE',
      },
      [
        {
          $set: {
            userId: userObjectId,
            entitlementKey: key,
            status: 'ACTIVE',
            subscriptionId,
            validFrom: {
              $ifNull: ['$validFrom', now],
            },
            validUntil: {
              $cond: [
                {
                  $gt: ['$validUntil', validUntil],
                },
                '$validUntil',
                validUntil,
              ],
            },
            source: {
              $ifNull: ['$source', 'SUBSCRIPTION'],
            },
            updatedAt: now,
            createdAt: {
              $ifNull: ['$createdAt', now],
            },
          },
        },
      ],
      {
        upsert: true,
        returnDocument: 'after',
        session,
      },
    );
  }
}