import { injectable } from 'tsyringe';
import Role, { IRole } from '../models/role.model';
import { BaseRepository } from './base.repository';
import { IRoleRepository } from './interfaces/IRoleRepository';

@injectable()
export class RoleRepository extends BaseRepository<IRole> implements IRoleRepository {
  constructor() {
    super(Role);
  }
}
