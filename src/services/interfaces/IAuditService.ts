import {
  AuditAction,
  AuditOutcome,
  AuditResourceType,
  AuditTargetType
} from '../../models/audit-log.model';
import { ClientSession } from 'mongoose';

export interface CreateAuditLogInput {
  actorId?: string;
  targetId?: string;
  resourceType?: AuditResourceType;
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

  createAuditLog(
    input: CreateAuditLogInput,
    session?: ClientSession,
  ): Promise<void>;
}
