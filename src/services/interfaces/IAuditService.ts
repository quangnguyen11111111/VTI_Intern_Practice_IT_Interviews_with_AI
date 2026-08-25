import {
  AuditAction,
  AuditOutcome
} from '../../models/audit-log.model';

export interface CreateAuditLogInput {
  actor: string;
  target: string;
  action: AuditAction;
  outcome: AuditOutcome;
}

export interface IAuditService {
  createAuditLog(
    input: CreateAuditLogInput
  ): Promise<void>;
}