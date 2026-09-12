import mongoose, { ClientSession } from 'mongoose';
import { AppError } from '../utils/AppError';
import { AuditAction, AuditResourceType } from '../models/audit-log.model';
import { IAuditService } from './interfaces/IAuditService';

export interface AuditedMutationInput {
  actorId: string;
  targetId?: string;
  resourceType: AuditResourceType;
  action: AuditAction;
  requestId: string;
}

interface MutationResult<T> { value: T; targetId?: string }

const auditExists = async (auditService: IAuditService, input: AuditedMutationInput): Promise<boolean> => {
  try {
    return await auditService.hasAudit(input.requestId, input.action);
  } catch {
    throw new AppError('Security audit is unavailable', 503, 'AUDIT_UNAVAILABLE');
  }
};

const safeReason = (error: unknown): string => {
  const code = error instanceof AppError ? error.code : undefined;
  return typeof code === 'string' && /^[A-Z][A-Z0-9_]{2,63}$/.test(code)
    ? code : 'MUTATION_FAILED';
};

// The business write and SUCCESS audit share one transaction. If audit persistence fails,
// MongoDB rolls the business write back. The unique requestId/action index prevents duplicate audit.
export async function runAuditedMutation<T>(
  auditService: IAuditService,
  input: AuditedMutationInput,
  mutation: (session: ClientSession) => Promise<MutationResult<T>>,
): Promise<T> {
  if (await auditExists(auditService, input)) {
    throw new AppError('Audited request has already been processed', 409, 'AUDIT_REPLAY');
  }
  const session = await mongoose.startSession();
  try {
    let result: MutationResult<T> | undefined;
    await session.withTransaction(async () => {
      result = await mutation(session);
      await auditService.createAuditLog({
        actorId: input.actorId,
        targetId: result.targetId ?? input.targetId,
        resourceType: input.resourceType,
        action: input.action,
        outcome: 'SUCCESS',
        requestId: input.requestId,
      }, session);
    });
    if (!result) throw new AppError('Mutation failed', 503, 'AUDIT_UNAVAILABLE');
    return result.value;
  } catch (error) {
    if (await auditExists(auditService, input)) {
      throw new AppError('Audited request has already been processed', 409, 'AUDIT_REPLAY');
    }
    try {
      await auditService.createAuditLog({
        actorId: input.actorId,
        targetId: input.targetId,
        resourceType: input.resourceType,
        action: input.action,
        outcome: 'FAILURE',
        requestId: input.requestId,
        reason: safeReason(error),
      });
    } catch {
      throw new AppError('Security audit is unavailable', 503, 'AUDIT_UNAVAILABLE');
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
