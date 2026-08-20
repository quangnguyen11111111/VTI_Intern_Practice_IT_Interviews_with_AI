import { injectable, inject } from 'tsyringe';
import { IRoleService } from './interfaces/IRoleService';
import { AppError } from '../utils/AppError';
import { IRoleRepository } from '../repositories/interfaces/IRoleRepository';

@injectable()
export class RoleService implements IRoleService {
  constructor(
    @inject('IRoleRepository') private roleRepository: IRoleRepository
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

  async createRole(data: any) {
    if (data.code) {
      const existing = await this.roleRepository.findOne({ code: data.code });
      if (existing) throw new AppError('Mã Role đã tồn tại', 400);
    }
    return this.roleRepository.create(data);
  }

  async updateRole(id: string, data: any) {
    if (data.code) {
      const existing = await this.roleRepository.findOne({ code: data.code });
      if (existing && existing._id.toString() !== id) throw new AppError('Mã Role đã tồn tại', 400);
    }
    const role = await this.roleRepository.update(id, data);
    if (!role) throw new AppError('Role không tồn tại', 404);
    return role;
  }

  async deleteRole(id: string) {
    const role = await this.roleRepository.softDelete(id);
    if (!role) throw new AppError('Role không tồn tại', 404);
    return role;
  }
}
