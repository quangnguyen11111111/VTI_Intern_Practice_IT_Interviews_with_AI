import {
  AuditAction,
  AuditOutcome,
  AuditResourceType,
} from '../../models/audit-log.model';
import { ClientSession } from 'mongoose';

export interface CreateAuditLogInput {
  actorId: string;
  targetId?: string;
  resourceType: AuditResourceType;
  action: AuditAction;
  outcome: AuditOutcome;
  requestId: string;
  reason?: string;
}

export interface IAuditService {
  hasAudit(requestId: string, action: AuditAction): Promise<boolean>;

  createAuditLog(
    input: CreateAuditLogInput,
    session?: ClientSession,
  ): Promise<void>;
}
