import mongoose, {
  Document,
  Schema
} from 'mongoose';

export type AuditOutcome =
  | 'SUCCESS'
  | 'FAILURE';

export type AuditAction =
  | 'LOCK_USER'
  | 'UNLOCK_USER';

export interface IAuditLog extends Document {
  actor: mongoose.Types.ObjectId;
  target: mongoose.Types.ObjectId;
  action: AuditAction;
  outcome: AuditOutcome;
  timestamp: Date;
}

const auditLogSchema =
  new Schema<IAuditLog>(
    {
      actor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },

      target: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },

      action: {
        type: String,
        enum: [
          'LOCK_USER',
          'UNLOCK_USER',
        ],
        required: true,
      },

      outcome: {
        type: String,
        enum: [
          'SUCCESS',
          'FAILURE',
        ],
        required: true,
      },

      timestamp: {
        type: Date,
        default: Date.now,
        required: true,
      },
    },
    {
      timestamps: false,
    }
  );

auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ target: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ timestamp: -1 });

const AuditLog =
  mongoose.model<IAuditLog>(
    'AuditLog',
    auditLogSchema
  );

export default AuditLog;