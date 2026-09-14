import mongoose, { Document, Schema } from 'mongoose';

export type EntitlementStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export type EntitlementSource =
  | 'SUBSCRIPTION'
  | 'ADMIN'
  | 'PROMOTION';

export interface IEntitlement extends Document {
  userId: mongoose.Types.ObjectId;
  subscriptionId: mongoose.Types.ObjectId;
  entitlementKey: string;
  status: EntitlementStatus;
  validFrom: Date;
  validUntil: Date;
  source: EntitlementSource;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IEntitlement>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
    },
    entitlementKey: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'REVOKED'],
      default: 'ACTIVE',
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validUntil: {
      type: Date,
      required: true,
      validate: {
        validator(value: Date) {
          const validFrom = (
            this as unknown as {
              validFrom?: Date;
            }
          ).validFrom;

          return !validFrom || value >= validFrom;
        },
        message:
          'validUntil must be greater than or equal to validFrom',
      },
    },
    source: {
      type: String,
      enum: ['SUBSCRIPTION', 'ADMIN', 'PROMOTION'],
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

schema.index(
  { userId: 1, entitlementKey: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
  },
);

export default mongoose.model<IEntitlement>(
  'Entitlement',
  schema,
);