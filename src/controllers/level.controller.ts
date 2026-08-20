import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { ILevelService } from '../services/interfaces/ILevelService';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../types/response.type';

@injectable()
export class LevelController {
  constructor(
    @inject('ILevelService') private levelService: ILevelService
  ) {}

  getLevels = catchAsync(async (req: Request, res: Response) => {
    const result = await this.levelService.getAllLevels(req.query);

    const response: ApiResponse = {
      success: true,
      message: 'Lấy danh sách Level thành công',
      data: result,
    };

    res.status(200).json(response);
  });

  getLevelById = catchAsync(async (req: Request, res: Response) => {
    const result = await this.levelService.getLevelById(req.params.id as string);
    res.status(200).json({ success: true, message: 'Lấy chi tiết Level thành công', data: result });
  });

  createLevel = catchAsync(async (req: Request, res: Response) => {
    const result = await this.levelService.createLevel(req.body);
    res.status(201).json({ success: true, message: 'Tạo Level thành công', data: result });
  });

  updateLevel = catchAsync(async (req: Request, res: Response) => {
    const result = await this.levelService.updateLevel(req.params.id as string, req.body);
    res.status(200).json({ success: true, message: 'Cập nhật Level thành công', data: result });
  });

  deleteLevel = catchAsync(async (req: Request, res: Response) => {
    await this.levelService.deleteLevel(req.params.id as string);
    res.status(200).json({ success: true, message: 'Xóa Level thành công' });
  });
}
