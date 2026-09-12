import mongoose, { Document, Schema } from 'mongoose';

export interface IUserQuotaLedgerDocument extends Document {
  actorId: mongoose.Types.ObjectId;
  operationId: mongoose.Types.ObjectId;
  quotaType: 'AI_GENERATION' | 'AI_EVALUATION';
  reservedUnits: number;
  status: 'RESERVED' | 'SETTLED' | 'RELEASED';
  usage?: { promptTokens: number; candidatesTokens: number; totalTokens: number };
  createdAt: Date;
  updatedAt: Date;
}

const UserQuotaLedgerSchema = new Schema<IUserQuotaLedgerDocument>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    operationId: { type: Schema.Types.ObjectId, ref: 'OperationRecord', required: true },
    quotaType: { type: String, enum: ['AI_GENERATION', 'AI_EVALUATION'], required: true },
    reservedUnits: { type: Number, default: 1, min: 0, required: true },
    status: {
      type: String,
      enum: ['RESERVED', 'SETTLED', 'RELEASED'],
      default: 'RESERVED',
      required: true
    },
    usage: {
      promptTokens: { type: Number, default: 0, min: 0 },
      candidatesTokens: { type: Number, default: 0, min: 0 },
      totalTokens: { type: Number, default: 0, min: 0 }
    }
  },
  { timestamps: true }
);

UserQuotaLedgerSchema.index(
  { actorId: 1, operationId: 1, quotaType: 1 },
  { unique: true }
);

export const UserQuotaLedgerModel = mongoose.model<IUserQuotaLedgerDocument>(
  'UserQuotaLedger',
  UserQuotaLedgerSchema
);
