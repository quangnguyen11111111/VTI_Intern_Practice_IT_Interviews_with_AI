import { injectable, inject } from 'tsyringe';
import { IRoleService } from './interfaces/IRoleService';
import { AppError } from '../utils/AppError';
import { IRoleRepository } from '../repositories/interfaces/IRoleRepository';
import { IAuditService } from './interfaces/IAuditService';
import { runAuditedMutation } from './audited-mutation';

@injectable()
export class RoleService implements IRoleService {
  constructor(
    @inject('IRoleRepository') private roleRepository: IRoleRepository,
    @inject('IAuditService') private auditService: IAuditService,
  ) {}

  async getAllRoles(query: any) {
    const { page = 1, limit = 10, status, code } = query;
    
    const filter: any = {};
    if (status) filter.status = status;
    if (code) filter.code = code;

    const skip = (Number(page) - 1) * Number(limit);

    const [roles, total] = await Promise.all([
      this.roleRepository.find(filter, { skip, limit: Number(limit), sort: { createdAt: -1 } }),
      this.roleRepository.count(filter),
    ]);

    return {
      roles,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }
    };
  }

  async getRoleById(id: string) {
    const role = await this.roleRepository.findById(id);
    if (!role) throw new AppError('Role không tồn tại', 404);
    return role;
  }

  async createRole(data: any, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, resourceType: 'ROLE', action: 'CREATE_ROLE', requestId,
    }, async session => {
      if (data.code && await this.roleRepository.findOne({ code: data.code })) {
        throw new AppError('Mã Role đã tồn tại', 400, 'TAXONOMY_CODE_EXISTS');
      }
      const value = await this.roleRepository.create(data, session);
      return { value, targetId: value._id.toString() };
    });
  }

  async updateRole(id: string, data: any, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, targetId: id, resourceType: 'ROLE', action: 'UPDATE_ROLE', requestId,
    }, async session => {
      if (data.code) {
        const existing = await this.roleRepository.findOne({ code: data.code });
        if (existing && existing._id.toString() !== id) throw new AppError('Mã Role đã tồn tại', 400, 'TAXONOMY_CODE_EXISTS');
      }
      const value = await this.roleRepository.update(id, data, session);
      if (!value) throw new AppError('Role không tồn tại', 404, 'TAXONOMY_NOT_FOUND');
      return { value };
    });
  }

  async deleteRole(id: string, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, targetId: id, resourceType: 'ROLE', action: 'DELETE_ROLE', requestId,
    }, async session => {
      const value = await this.roleRepository.softDelete(id, session);
      if (!value) throw new AppError('Role không tồn tại', 404, 'TAXONOMY_NOT_FOUND');
      return { value };
    });
  }
}
