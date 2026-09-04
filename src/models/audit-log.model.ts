import mongoose, {
  Document,
  Schema
} from 'mongoose';

export type AuditOutcome =
  | 'SUCCESS'
  | 'FAILURE';

export type AuditAction =
  | 'LOCK_USER'
  | 'UNLOCK_USER'
  | 'CREATE_PROMPT_DRAFT'
  | 'PUBLISH_PROMPT'
  | 'ROLLBACK_PROMPT';

export type AuditTargetType =
  | 'USER'
  | 'SYSTEM_PROMPT';

export interface IAuditLog extends Document {
  actor: mongoose.Types.ObjectId;
  target: mongoose.Types.ObjectId;
  targetType: AuditTargetType;
  action: AuditAction;
  outcome: AuditOutcome;
  version?: number;
  timestamp: Date;
}

const auditLogSchema =
  new Schema<IAuditLog>(
    {
      actor: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      target: {
        type: Schema.Types.ObjectId,
        required: true
      },

      targetType: {
        type: String,
        enum: [
          'USER',
          'SYSTEM_PROMPT'
        ],
        default: 'USER',
        required: true
      },

      action: {
        type: String,
        enum: [
          'LOCK_USER',
          'UNLOCK_USER',
          'CREATE_PROMPT_DRAFT',
          'PUBLISH_PROMPT',
          'ROLLBACK_PROMPT'
        ],
        required: true
      },

      outcome: {
        type: String,
        enum: [
          'SUCCESS',
          'FAILURE'
        ],
        required: true
      },

      version: {
        type: Number,
        min: 1
      },

      timestamp: {
        type: Date,
        default: Date.now,
        required: true
      }
    },
    {
      timestamps: false
    }
  );

auditLogSchema.index({
  actor: 1
});

auditLogSchema.index({
  target: 1
});

auditLogSchema.index({
  targetType: 1,
  target: 1
});

auditLogSchema.index({
  action: 1
});

auditLogSchema.index({
  timestamp: -1
});

const AuditLog =
  mongoose.model<IAuditLog>(
    'AuditLog',
    auditLogSchema
  );

export default AuditLog;