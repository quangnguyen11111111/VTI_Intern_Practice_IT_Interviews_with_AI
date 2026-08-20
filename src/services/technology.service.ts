import { injectable, inject } from 'tsyringe';
import { ITechnologyService } from './interfaces/ITechnologyService';
import { AppError } from '../utils/AppError';
import { ITechnologyRepository } from '../repositories/interfaces/ITechnologyRepository';

@injectable()
export class TechnologyService implements ITechnologyService {
  constructor(
    @inject('ITechnologyRepository') private technologyRepository: ITechnologyRepository
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

  async createTechnology(data: any) {
    if (data.code) {
      const existing = await this.technologyRepository.findOne({ code: data.code });
      if (existing) throw new AppError('Mã Technology đã tồn tại', 400);
    }
    return this.technologyRepository.create(data);
  }

  async updateTechnology(id: string, data: any) {
    if (data.code) {
      const existing = await this.technologyRepository.findOne({ code: data.code });
      if (existing && existing._id.toString() !== id) throw new AppError('Mã Technology đã tồn tại', 400);
    }
    const technology = await this.technologyRepository.update(id, data);
    if (!technology) throw new AppError('Technology không tồn tại', 404);
    return technology;
  }

  async deleteTechnology(id: string) {
    const technology = await this.technologyRepository.softDelete(id);
    if (!technology) throw new AppError('Technology không tồn tại', 404);
    return technology;
  }
}
