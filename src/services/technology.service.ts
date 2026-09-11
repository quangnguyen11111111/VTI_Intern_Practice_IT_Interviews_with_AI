import { injectable, inject } from 'tsyringe';
import { ITechnologyService } from './interfaces/ITechnologyService';
import { AppError } from '../utils/AppError';
import { ITechnologyRepository } from '../repositories/interfaces/ITechnologyRepository';
import { IAuditService } from './interfaces/IAuditService';
import { runAuditedMutation } from './audited-mutation';

@injectable()
export class TechnologyService implements ITechnologyService {
  constructor(
    @inject('ITechnologyRepository') private technologyRepository: ITechnologyRepository,
    @inject('IAuditService') private auditService: IAuditService,
  ) {}

  async getAllTechnologies(query: any) {
    const { page = 1, limit = 10, status, roleId, code } = query;
    
    const filter: any = {};
    if (status) filter.status = status;
    if (code) filter.code = code;
    if (roleId) filter.roles = roleId;

    const skip = (Number(page) - 1) * Number(limit);

    const [technologies, total] = await Promise.all([
      this.technologyRepository.find(filter, { 
        skip, 
        limit: Number(limit), 
        sort: { createdAt: -1 }, 
        populate: { path: 'roles', select: 'name code' } 
      }),
      this.technologyRepository.count(filter),
    ]);

    return {
      technologies,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }
    };
  }

  async getTechnologyById(id: string) {
    const technology = await this.technologyRepository.findById(id, { path: 'roles', select: 'name code' });
    if (!technology) throw new AppError('Technology không tồn tại', 404);
    return technology;
  }

  async createTechnology(data: any, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, resourceType: 'TECHNOLOGY', action: 'CREATE_TECHNOLOGY', requestId,
    }, async session => {
      if (data.code && await this.technologyRepository.findOne({ code: data.code })) {
        throw new AppError('Mã Technology đã tồn tại', 409, 'TAXONOMY_CODE_EXISTS');
      }
      const value = await this.technologyRepository.create(data, session);
      return { value, targetId: value._id.toString() };
    });
  }

  async updateTechnology(id: string, data: any, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, targetId: id, resourceType: 'TECHNOLOGY', action: 'UPDATE_TECHNOLOGY', requestId,
    }, async session => {
      if (data.code) {
        const existing = await this.technologyRepository.findOne({ code: data.code });
        if (existing && existing._id.toString() !== id) throw new AppError('Mã Technology đã tồn tại', 409, 'TAXONOMY_CODE_EXISTS');
      }
      const value = await this.technologyRepository.update(id, data, session);
      if (!value) throw new AppError('Technology không tồn tại', 404, 'TAXONOMY_NOT_FOUND');
      return { value };
    });
  }

  async deleteTechnology(id: string, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, targetId: id, resourceType: 'TECHNOLOGY', action: 'DELETE_TECHNOLOGY', requestId,
    }, async session => {
      const value = await this.technologyRepository.softDelete(id, session);
      if (!value) throw new AppError('Technology không tồn tại', 404, 'TAXONOMY_NOT_FOUND');
      return { value };
    });
  }
}
