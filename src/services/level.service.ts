import { injectable, inject } from 'tsyringe';
import { ILevelService } from './interfaces/ILevelService';
import { AppError } from '../utils/AppError';
import { ILevelRepository } from '../repositories/interfaces/ILevelRepository';
import { IAuditService } from './interfaces/IAuditService';
import { runAuditedMutation } from './audited-mutation';

@injectable()
export class LevelService implements ILevelService {
  constructor(
    @inject('ILevelRepository') private levelRepository: ILevelRepository,
    @inject('IAuditService') private auditService: IAuditService,
  ) {}

  async getAllLevels(query: any) {
    const { page = 1, limit = 10, status, code } = query;
    
    const filter: any = {};
    if (status) filter.status = status;
    if (code) filter.code = code;

    const skip = (Number(page) - 1) * Number(limit);

    const [levels, total] = await Promise.all([
      this.levelRepository.find(filter, { skip, limit: Number(limit), sort: { createdAt: -1 } }),
      this.levelRepository.count(filter),
    ]);

    return {
      levels,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }
    };
  }

  async getLevelById(id: string) {
    const level = await this.levelRepository.findById(id);
    if (!level) throw new AppError('Level không tồn tại', 404);
    return level;
  }

  async createLevel(data: any, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, resourceType: 'LEVEL', action: 'CREATE_LEVEL', requestId,
    }, async session => {
      if (data.code && await this.levelRepository.findOne({ code: data.code })) {
        throw new AppError('Mã Level đã tồn tại', 400, 'TAXONOMY_CODE_EXISTS');
      }
      const value = await this.levelRepository.create(data, session);
      return { value, targetId: value._id.toString() };
    });
  }

  async updateLevel(id: string, data: any, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, targetId: id, resourceType: 'LEVEL', action: 'UPDATE_LEVEL', requestId,
    }, async session => {
      if (data.code) {
        const existing = await this.levelRepository.findOne({ code: data.code });
        if (existing && existing._id.toString() !== id) throw new AppError('Mã Level đã tồn tại', 400, 'TAXONOMY_CODE_EXISTS');
      }
      const value = await this.levelRepository.update(id, data, session);
      if (!value) throw new AppError('Level không tồn tại', 404, 'TAXONOMY_NOT_FOUND');
      return { value };
    });
  }

  async deleteLevel(id: string, actorId: string, requestId: string) {
    return runAuditedMutation(this.auditService, {
      actorId, targetId: id, resourceType: 'LEVEL', action: 'DELETE_LEVEL', requestId,
    }, async session => {
      const value = await this.levelRepository.softDelete(id, session);
      if (!value) throw new AppError('Level không tồn tại', 404, 'TAXONOMY_NOT_FOUND');
      return { value };
    });
  }
}
