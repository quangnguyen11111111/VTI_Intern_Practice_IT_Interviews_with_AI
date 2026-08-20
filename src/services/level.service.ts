import { injectable, inject } from 'tsyringe';
import { ILevelService } from './interfaces/ILevelService';
import { AppError } from '../utils/AppError';
import { ILevelRepository } from '../repositories/interfaces/ILevelRepository';

@injectable()
export class LevelService implements ILevelService {
  constructor(
    @inject('ILevelRepository') private levelRepository: ILevelRepository
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

  async createLevel(data: any) {
    if (data.code) {
      const existing = await this.levelRepository.findOne({ code: data.code });
      if (existing) throw new AppError('Mã Level đã tồn tại', 400);
    }
    return this.levelRepository.create(data);
  }

  async updateLevel(id: string, data: any) {
    if (data.code) {
      const existing = await this.levelRepository.findOne({ code: data.code });
      if (existing && existing._id.toString() !== id) throw new AppError('Mã Level đã tồn tại', 400);
    }
    const level = await this.levelRepository.update(id, data);
    if (!level) throw new AppError('Level không tồn tại', 404);
    return level;
  }

  async deleteLevel(id: string) {
    const level = await this.levelRepository.softDelete(id);
    if (!level) throw new AppError('Level không tồn tại', 404);
    return level;
  }
}
