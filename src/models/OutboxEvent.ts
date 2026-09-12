import mongoose, { Document, Schema } from 'mongoose';

export type OutboxStatus = 'PENDING' | 'LEASED' | 'PUBLISHED' | 'FAILED';
export type InterviewEventType =
  | 'INTERVIEW_GENERATION_REQUESTED'
  | 'INTERVIEW_EVALUATION_REQUESTED';

export interface IOutboxEventDocument extends Document {
  businessKey: string;
  eventType: InterviewEventType;
  aggregateId: mongoose.Types.ObjectId;
  aggregateVersion: number;
  operationId: mongoose.Types.ObjectId;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: Date;
  leasedUntil?: Date | null;
  leaseToken?: string | null;
  safeErrorCode?: string | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OutboxEventSchema = new Schema<IOutboxEventDocument>(
  {
    businessKey: { type: String, required: true, maxlength: 200 },
    eventType: {
      type: String,
      enum: ['INTERVIEW_GENERATION_REQUESTED', 'INTERVIEW_EVALUATION_REQUESTED'],
      required: true
    },
    aggregateId: { type: Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
    aggregateVersion: { type: Number, required: true, min: 1 },
    operationId: { type: Schema.Types.ObjectId, ref: 'OperationRecord', required: true },
    status: {
      type: String,
      enum: ['PENDING', 'LEASED', 'PUBLISHED', 'FAILED'],
      default: 'PENDING',
      required: true
    },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now, required: true },
    leasedUntil: { type: Date, default: null },
    leaseToken: { type: String, default: null },
    safeErrorCode: { type: String, default: null },
    publishedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

OutboxEventSchema.index({ businessKey: 1 }, { unique: true });
OutboxEventSchema.index({ status: 1, nextAttemptAt: 1 });

export const OutboxEventModel = mongoose.model<IOutboxEventDocument>(
  'OutboxEvent',
  OutboxEventSchema
);
