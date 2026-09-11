import { ClientSession } from 'mongoose';
import {
  AuditAction,
  AuditOutcome,
  AuditResourceType,
  AuditTargetType,
} from '../../models/audit-log.model';

export interface CreateAuditLogInput {
  actorId?: string;
  targetId?: string;
  resourceType?: AuditResourceType;
  // Legacy aliases are retained for system-prompt mutations.
  actor?: string;
  target?: string;
  targetType?: AuditTargetType;
  action: AuditAction;
  outcome: AuditOutcome;
  requestId?: string;
  reason?: string;
  version?: number;
}

export interface IAuditService {
  hasAudit(requestId: string, action: AuditAction): Promise<boolean>;
  createAuditLog(input: CreateAuditLogInput, session?: ClientSession): Promise<void>;
}
