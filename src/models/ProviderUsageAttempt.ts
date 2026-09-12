import mongoose, { Document, Schema } from 'mongoose';

export interface IProviderUsageAttemptDocument extends Document {
  operationId: mongoose.Types.ObjectId;
  attempt: number;
  status: 'STARTED' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
  usage?: { promptTokens: number; candidatesTokens: number; totalTokens: number };
  safeErrorCode?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderUsageAttemptSchema = new Schema<IProviderUsageAttemptDocument>(
  {
    operationId: { type: Schema.Types.ObjectId, ref: 'OperationRecord', required: true },
    attempt: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ['STARTED', 'SUCCEEDED', 'FAILED', 'UNKNOWN'],
      default: 'STARTED',
      required: true
    },
    usage: {
      promptTokens: { type: Number, default: 0, min: 0 },
      candidatesTokens: { type: Number, default: 0, min: 0 },
      totalTokens: { type: Number, default: 0, min: 0 }
    },
    safeErrorCode: { type: String, default: null },
    startedAt: { type: Date, default: Date.now, required: true },
    finishedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

ProviderUsageAttemptSchema.index({ operationId: 1, attempt: 1 }, { unique: true });

export const ProviderUsageAttemptModel = mongoose.model<IProviderUsageAttemptDocument>(
  'ProviderUsageAttempt',
  ProviderUsageAttemptSchema
);
