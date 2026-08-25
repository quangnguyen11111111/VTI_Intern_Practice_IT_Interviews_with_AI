import { IAuditLog } from '../../models/audit-log.model';
import { IBaseRepository } from './IBaseRepository';

export interface IAuditRepository
  extends IBaseRepository<IAuditLog> {}