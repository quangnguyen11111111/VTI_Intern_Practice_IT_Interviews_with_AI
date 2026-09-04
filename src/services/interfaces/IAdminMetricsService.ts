import  {
    AdminMetricsDateRange,
    AdminUserMetrics,
    AdminInterviewMetrics
} from '../../repositories/interfaces/IAdminMetricsRepository';

export interface IAdminMetricsService {
    getMetrics(
        range: AdminMetricsDateRange
    ): Promise<{
        users: AdminUserMetrics;
        interviews: AdminInterviewMetrics;
    }>;
}