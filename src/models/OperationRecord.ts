import mongoose, { Document, Schema } from 'mongoose';

export type OperationAction = 'GENERATE_QUESTIONS' | 'SUBMIT_ANSWERS';
export type OperationStatus = 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export interface IOperationRecordDocument extends Document {
  actorId: mongoose.Types.ObjectId;
  route: string;
  action: OperationAction;
  targetId: mongoose.Types.ObjectId;
  idempotencyKeyHash: string;
  requestFingerprint: string;
  status: OperationStatus;
  aggregateVersion: number;
  responseRef?: mongoose.Types.ObjectId | null;
  safeErrorCode?: string | null;
  attempts: number;
  nextAttemptAt: Date;
  leaseToken?: string | null;
  leaseExpiresAt?: Date | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OperationRecordSchema = new Schema<IOperationRecordDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    route: { type: String, required: true, maxlength: 160 },
    action: { type: String, enum: ['GENERATE_QUESTIONS', 'SUBMIT_ANSWERS'], required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
    idempotencyKeyHash: { type: String, required: true, minlength: 64, maxlength: 64 },
    requestFingerprint: { type: String, required: true, minlength: 64, maxlength: 64 },
    status: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'],
      default: 'PENDING',
      required: true
    },
    aggregateVersion: { type: Number, required: true, min: 1 },
    responseRef: { type: Schema.Types.ObjectId, default: null },
    safeErrorCode: { type: String, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    nextAttemptAt: { type: Date, default: Date.now, required: true },
    leaseToken: { type: String, default: null },
    leaseExpiresAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true }
);

OperationRecordSchema.index(
  { actorId: 1, route: 1, idempotencyKeyHash: 1 },
  { unique: true }
);
OperationRecordSchema.index({ status: 1, nextAttemptAt: 1 });
OperationRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });

export const OperationRecordModel = mongoose.model<IOperationRecordDocument>(
  'OperationRecord',
  OperationRecordSchema
);
