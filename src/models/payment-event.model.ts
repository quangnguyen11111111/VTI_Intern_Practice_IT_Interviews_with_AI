import mongoose, { Document, Schema } from 'mongoose';

export type PaymentEventStatus =
  | 'RECEIVED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'IGNORED'
  | 'FAILED';

export interface IPaymentEvent extends Document {
  provider: 'MOCK' | 'STRIPE' | 'VNPAY';
  eventId: string;
  eventType: string;
  paymentAttemptId?: mongoose.Types.ObjectId | null;
  payloadHash: string;
  payload: Record<string, unknown>;
  status: PaymentEventStatus;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date | null;
}

const schema = new Schema<IPaymentEvent>(
  {
    provider: {
      type: String,
      enum: ['MOCK', 'STRIPE', 'VNPAY'],
      required: true,
      trim: true,
    },
    eventId: {
      type: String,
      required: true,
      maxlength: 200,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      maxlength: 100,
      trim: true,
    },
    paymentAttemptId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentAttempt',
      default: null,
    },
    payloadHash: {
      type: String,
      required: true,
      maxlength: 128,
      trim: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'RECEIVED',
        'PROCESSING',
        'PROCESSED',
        'IGNORED',
        'FAILED',
      ],
      default: 'RECEIVED',
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

schema.index(
  { provider: 1, eventId: 1 },
  { unique: true },
);

schema.index({ status: 1, createdAt: 1 });

export default mongoose.model<IPaymentEvent>(
  'PaymentEvent',
  schema,
);