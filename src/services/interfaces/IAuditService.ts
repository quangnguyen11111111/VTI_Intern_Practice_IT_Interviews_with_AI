import {
  AuditAction,
  AuditOutcome,
  AuditTargetType
} from '../../models/audit-log.model';

export interface CreateAuditLogInput {
  actor: string;
  target: string;
  targetType?: AuditTargetType;
  action: AuditAction;
  outcome: AuditOutcome;
  version?: number;
}

export interface IAuditService {
  createAuditLog(
    input: CreateAuditLogInput
  ): Promise<void>;
}