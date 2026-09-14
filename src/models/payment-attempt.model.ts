import mongoose, { Document, Schema } from 'mongoose';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'EXPIRED';

export interface IPaymentAttempt extends Document {
  userId: mongoose.Types.ObjectId;
  planId: mongoose.Types.ObjectId;
  idempotencyKey: string;
  checkoutReference: string;
  provider: 'MOCK' | 'STRIPE' | 'VNPAY';
  providerPaymentId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  checkoutUrl?: string | null;
  failureCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPaymentAttempt>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      maxlength: 255,
      trim: true,
    },
    checkoutReference: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    provider: {
      type: String,
      enum: ['MOCK', 'STRIPE', 'VNPAY'],
      required: true,
    },
    providerPaymentId: {
      type: String,
      default: null,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'],
      default: 'PENDING',
    },
    checkoutUrl: {
      type: String,
      default: null,
    },
    failureCode: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

schema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true },
);

schema.index(
  { checkoutReference: 1 },
  { unique: true },
);

schema.index(
  { provider: 1, providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerPaymentId: { $exists: true },
    },
  },
);

export default mongoose.model<IPaymentAttempt>(
  'PaymentAttempt',
  schema,
);