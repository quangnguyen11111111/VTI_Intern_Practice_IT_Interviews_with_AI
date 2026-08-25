import {
  injectable,
  inject
} from 'tsyringe';

import mongoose from 'mongoose';

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

  async createAuditLog(
    input: CreateAuditLogInput
  ): Promise<void> {
    const {
      actor,
      target,
      action,
      outcome
    } = input;

    if (!mongoose.isValidObjectId(actor)) {
      throw new Error(
        'INVALID_ACTOR_ID'
      );
    }

    if (!mongoose.isValidObjectId(target)) {
      throw new Error(
        'INVALID_TARGET_ID'
      );
    }

    await this.auditRepository.create({
      actor:
        new mongoose.Types.ObjectId(actor),
      target:
        new mongoose.Types.ObjectId(target),
      action,
      outcome,
      timestamp: new Date(),
    });
  }
}