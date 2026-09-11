import {
  injectable,
  inject
} from 'tsyringe';

import mongoose, { ClientSession } from 'mongoose';

import {
  IAuditService,
  CreateAuditLogInput
} from './interfaces/IAuditService';

import { IAuditRepository } from '../repositories/interfaces/IAuditRepository';

@injectable()
export class AuditService
  implements IAuditService
{
  constructor(
    @inject('IAuditRepository')
    private readonly auditRepository:
      IAuditRepository
  ) {}

  async hasAudit(requestId: string, action: CreateAuditLogInput['action']): Promise<boolean> {
    return Boolean(await this.auditRepository.findOne({ requestId, action }));
  }

  async createAuditLog(
    input: CreateAuditLogInput,
    session?: ClientSession,
  ): Promise<void> {
    const {
      actorId,
      targetId,
      resourceType,
      action,
      outcome,
      requestId,
      reason,
    } = input;

    if (!mongoose.isValidObjectId(actorId)) {
      throw new Error(
        'INVALID_ACTOR_ID'
      );
    }

    if (targetId && !mongoose.isValidObjectId(targetId)) {
      throw new Error(
        'INVALID_TARGET_ID'
      );
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new Error('INVALID_REQUEST_ID');
    }
    const safeReason = reason && /^[A-Z][A-Z0-9_]{2,63}$/.test(reason) ? reason : undefined;
    await this.auditRepository.create({
      actor:
        new mongoose.Types.ObjectId(actorId),
      target: targetId ? new mongoose.Types.ObjectId(targetId) : undefined,
      resourceType,
      action,
      outcome,
      requestId,
      reason: safeReason,
      timestamp: new Date(),
    }, session);
  }
}
