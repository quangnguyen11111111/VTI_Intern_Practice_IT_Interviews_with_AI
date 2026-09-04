import { Request, Response, NextFunction } from 'express';
import { injectable, inject } from 'tsyringe';

import { IAdminMetricsService } from '../services/interfaces/IAdminMetricsService';
import { AdminMetricsDateRange } from '../repositories/interfaces/IAdminMetricsRepository';

@injectable()
export class AdminMetricsController {
    constructor(
        @inject('IAdminMetricsService')
        private readonly metricsService: IAdminMetricsService
    ){}

    async getMetrics(
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<void> {
        try{
            const from = this.parseDate(req.query.from);
            const to = this.parseDate(req.query.to);

            if (!from || !to) {
                res.status(400).json({
                    success: false,
                    message: 'from and to must be valid dates.'
                });
                return;
            }

            if (from >= to) {
                res.status(400).json({
                    success: false,
                    message: 'The from date must be earlier than the to date.'
                });
                return;
            }

            const range: AdminMetricsDateRange = {
                from,
                to
            };
            const metrics =
              await this.metricsService.getMetrics(range);
              res.status(200).json({
                success: true,
                data: metrics
              });
        } catch(error) {
            next(error);
        }
    }

    private parseDate(value: unknown): Date | null {
        if (typeof value !== 'string' || !value.trim()) {
            return null;
        }
        const date  = new Date(value);
        return Number.isNaN(date.getTime())
           ? null
           : date;
    }
}