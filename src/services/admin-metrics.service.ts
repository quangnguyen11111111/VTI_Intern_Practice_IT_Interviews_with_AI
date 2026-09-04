import { injectable, inject } from 'tsyringe';

import {
    AdminMetricsDateRange,
    AdminUserMetrics,
    AdminInterviewMetrics,
    IAdminMetricsRepository
} from '../repositories/interfaces/IAdminMetricsRepository';

import { IAdminMetricsService } from './interfaces/IAdminMetricsService';


@injectable()
export class AdminMetricsService
   implements IAdminMetricsService
{
    constructor(
        @inject('IAdminMetricsRepository')
        private readonly metricsRepository: IAdminMetricsRepository
    ){}

    async getMetrics(
        range: AdminMetricsDateRange
    ): Promise<{
        users: AdminUserMetrics;
        interviews: AdminInterviewMetrics;
    }> {
        const [users, interviews] = await Promise.all([
            this.metricsRepository.getUserMetrics(),
            this.metricsRepository.getInterviewMetrics(range)
        ]);

        return {
            users,
            interviews
        };
    }
}