import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { IRoleService } from '../services/interfaces/IRoleService';
import { catchAsync } from '../utils/catchAsync';
import { ApiResponse } from '../types/response.type';

@injectable()
export class RoleController {
  constructor(
    @inject('IRoleService') private roleService: IRoleService
  ) {}

  getRoles = catchAsync(async (req: Request, res: Response) => {
    const result = await this.roleService.getAllRoles(req.query);

    const response: ApiResponse = {
      success: true,
      message: 'Lấy danh sách Role thành công',
      data: result,
    };

    res.status(200).json(response);
  });

  getRoleById = catchAsync(async (req: Request, res: Response) => {
    const result = await this.roleService.getRoleById(req.params.id as string);
    res.status(200).json({ success: true, message: 'Lấy chi tiết Role thành công', data: result });
  });

  createRole = catchAsync(async (req: Request, res: Response) => {
    const result = await this.roleService.createRole(req.body);
    res.status(201).json({ success: true, message: 'Tạo Role thành công', data: result });
  });

  updateRole = catchAsync(async (req: Request, res: Response) => {
    const result = await this.roleService.updateRole(req.params.id as string, req.body);
    res.status(200).json({ success: true, message: 'Cập nhật Role thành công', data: result });
  });

  deleteRole = catchAsync(async (req: Request, res: Response) => {
    await this.roleService.deleteRole(req.params.id as string);
    res.status(200).json({ success: true, message: 'Xóa Role thành công' });
  });
}
