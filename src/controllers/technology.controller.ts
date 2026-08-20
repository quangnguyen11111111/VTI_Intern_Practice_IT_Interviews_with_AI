import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { ITechnologyService } from '../services/interfaces/ITechnologyService';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../types/response.type';

@injectable()
export class TechnologyController {
  constructor(
    @inject('ITechnologyService') private technologyService: ITechnologyService
  ) {}

  getTechnologies = catchAsync(async (req: Request, res: Response) => {
    const result = await this.technologyService.getAllTechnologies(req.query);

    const response: ApiResponse = {
      success: true,
      message: 'Lấy danh sách Technology thành công',
      data: result,
    };

    res.status(200).json(response);
  });

  getTechnologyById = catchAsync(async (req: Request, res: Response) => {
    const result = await this.technologyService.getTechnologyById(req.params.id as string);
    res.status(200).json({ success: true, message: 'Lấy chi tiết Technology thành công', data: result });
  });

  createTechnology = catchAsync(async (req: Request, res: Response) => {
    const result = await this.technologyService.createTechnology(req.body);
    res.status(201).json({ success: true, message: 'Tạo Technology thành công', data: result });
  });

  updateTechnology = catchAsync(async (req: Request, res: Response) => {
    const result = await this.technologyService.updateTechnology(req.params.id as string, req.body);
    res.status(200).json({ success: true, message: 'Cập nhật Technology thành công', data: result });
  });

  deleteTechnology = catchAsync(async (req: Request, res: Response) => {
    await this.technologyService.deleteTechnology(req.params.id as string);
    res.status(200).json({ success: true, message: 'Xóa Technology thành công' });
  });
}
