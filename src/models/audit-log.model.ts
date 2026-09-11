import mongoose, { Document, Schema } from 'mongoose';

export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export type AuditAction =
  | 'LOCK_USER'
  | 'UNLOCK_USER'
  | 'CREATE_ROLE'
  | 'UPDATE_ROLE'
  | 'DELETE_ROLE'
  | 'CREATE_LEVEL'
  | 'UPDATE_LEVEL'
  | 'DELETE_LEVEL'
  | 'CREATE_TECHNOLOGY'
  | 'UPDATE_TECHNOLOGY'
  | 'DELETE_TECHNOLOGY'
  | 'CREATE_PROMPT_DRAFT'
  | 'PUBLISH_PROMPT'
  | 'ROLLBACK_PROMPT';

export type AuditResourceType = 'USER' | 'ROLE' | 'LEVEL' | 'TECHNOLOGY';
export type AuditTargetType = 'USER' | 'SYSTEM_PROMPT';

export interface IAuditLog extends Document {
  actor: mongoose.Types.ObjectId;
  target?: mongoose.Types.ObjectId;
  targetType: AuditTargetType;
  resourceType?: AuditResourceType;
  action: AuditAction;
  outcome: AuditOutcome;
  requestId: string;
  reason?: string;
  version?: number;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      immutable: true,
    },
    target: {
      type: Schema.Types.ObjectId,
      required: false,
      immutable: true,
    },
    targetType: {
      type: String,
      enum: ['USER', 'SYSTEM_PROMPT'],
      default: 'USER',
      required: true,
      immutable: true,
    },
    resourceType: {
      type: String,
      enum: ['USER', 'ROLE', 'LEVEL', 'TECHNOLOGY'],
      required: false,
      immutable: true,
    },
    action: {
      type: String,
      enum: [
        'LOCK_USER',
        'UNLOCK_USER',
        'CREATE_ROLE',
        'UPDATE_ROLE',
        'DELETE_ROLE',
        'CREATE_LEVEL',
        'UPDATE_LEVEL',
        'DELETE_LEVEL',
        'CREATE_TECHNOLOGY',
        'UPDATE_TECHNOLOGY',
        'DELETE_TECHNOLOGY',
        'CREATE_PROMPT_DRAFT',
        'PUBLISH_PROMPT',
        'ROLLBACK_PROMPT',
      ],
      required: true,
      immutable: true,
    },
    outcome: {
      type: String,
      enum: ['SUCCESS', 'FAILURE'],
      required: true,
      immutable: true,
    },
    requestId: {
      type: String,
      required: true,
      immutable: true,
      match: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    },
    reason: {
      type: String,
      required: false,
      immutable: true,
      maxlength: 64,
      match: /^[A-Z][A-Z0-9_]{2,63}$/,
    },
    version: {
      type: Number,
      min: 1,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      immutable: true,
    },
  },
  { timestamps: false },
);

auditLogSchema.index({ actor: 1 });
auditLogSchema.index({ target: 1 });
auditLogSchema.index({ targetType: 1, target: 1 });
auditLogSchema.index({ resourceType: 1, target: 1, timestamp: -1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ requestId: 1, action: 1 }, { unique: true });

const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;
