import { injectable } from 'tsyringe';
import mongoose, { ClientSession } from 'mongoose';
import Subscription, { ISubscription } from '../models/subscription.model';
import { ISubscriptionRepository } from './interfaces/ISubscriptionRepository';

@injectable()
export class SubscriptionRepository implements ISubscriptionRepository {
  async create(
    data: Partial<ISubscription>,
    session?: ClientSession,
  ): Promise<ISubscription> {
    const doc = new Subscription(data);
    await doc.save({ session });
    return doc;
  }

  findActiveByUserAndPlan(
    userId: string,
    planId: string,
    session?: ClientSession,
  ): Promise<ISubscription | null> {
    return Subscription.findOne({
      userId,
      planId,
      status: 'ACTIVE',
    })
      .sort({ expiresAt: -1, _id: 1 })
      .session(session ?? null);
  }

  extendActive(
    id: string,
    expiresAt: Date,
    session?: ClientSession,
  ): Promise<ISubscription | null> {
    return Subscription.findOneAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(id),
        status: 'ACTIVE',
      },
      {
        $set: {
          expiresAt,
        },
      },
      {
        returnDocument: 'after',
        session,
      },
    );
  }

  async createOrExtendActive(
    userId: string,
    planId: string,
    durationDays: number,
    now: Date,
    session?: ClientSession,
  ): Promise<ISubscription | null> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const planObjectId = new mongoose.Types.ObjectId(planId);
    const durationMs = durationDays * 86_400_000;

    const doc = await Subscription.findOneAndUpdate(
      {
        userId: userObjectId,
        planId: planObjectId,
        status: 'ACTIVE',
      },
      [
        {
          $set: {
            userId: userObjectId,
            planId: planObjectId,
            status: 'ACTIVE',
            startedAt: {
              $ifNull: ['$startedAt', now],
            },
            expiresAt: {
              $add: [
                {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$expiresAt', null] },
                        { $gt: ['$expiresAt', now] },
                      ],
                    },
                    '$expiresAt',
                    now,
                  ],
                },
                durationMs,
              ],
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

    return doc;
  }
}