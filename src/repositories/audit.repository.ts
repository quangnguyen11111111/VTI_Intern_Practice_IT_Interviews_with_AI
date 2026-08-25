import { injectable } from 'tsyringe';

import AuditLog, {
  IAuditLog
} from '../models/audit-log.model';

import { BaseRepository } from './base.repository';

import { IAuditRepository } from './interfaces/IAuditRepository';

@injectable()
export class AuditRepository
  extends BaseRepository<IAuditLog>
  implements IAuditRepository
{
  constructor() {
    super(AuditLog);
  }
}