import { injectable } from 'tsyringe';

import User from '../models/user.model';
import { InterviewSessionModel } from '../models/InterviewSession';

import {
  AdminMetricsDateRange,
  AdminUserMetrics,
  AdminInterviewMetrics,
  IAdminMetricsRepository
} from './interfaces/IAdminMetricsRepository';

@injectable()
export class AdminMetricsRepository
  implements IAdminMetricsRepository
{
  /**
   * User metric hiện là snapshot tại thời điểm hiện tại,
   * chưa áp dụng bộ lọc thời gian.
   */
  async getUserMetrics(): Promise<AdminUserMetrics> {
    const [result] = await User.aggregate([
      {
        $group: {
          _id: null,

          total: {
            $sum: 1
          },

          active: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'ACTIVE'] },
                1,
                0
              ]
            }
          },

          locked: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'LOCKED'] },
                1,
                0
              ]
            }
          },

          inactive: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'INACTIVE'] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    return {
      total: result?.total ?? 0,
      active: result?.active ?? 0,
      locked: result?.locked ?? 0,
      inactive: result?.inactive ?? 0
    };
  }

  /**
   * Interview lọc theo createdAt và dùng [from, to)
   * để tránh đếm trùng tại thời điểm biên.
   */
  async getInterviewMetrics(
    range: AdminMetricsDateRange
  ): Promise<AdminInterviewMetrics> {
    const [result] = await InterviewSessionModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: range.from,
            $lt: range.to
          }
        }
      },

      {
        $group: {
          _id: null,

          total: {
            $sum: 1
          },

          pending: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'PENDING'] },
                1,
                0
              ]
            }
          },

          generating: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'GENERATING'] },
                1,
                0
              ]
            }
          },

          inProgress: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'IN_PROGRESS'] },
                1,
                0
              ]
            }
          },

          evaluating: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'EVALUATING'] },
                1,
                0
              ]
            }
          },

          completed: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'COMPLETED'] },
                1,
                0
              ]
            }
          },

          failed: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'FAILED'] },
                1,
                0
              ]
            }
          },

          promptTokens: {
            $sum: {
              $ifNull: [
                '$metadata.promptTokens',
                0
              ]
            }
          },

          candidatesTokens: {
            $sum: {
              $ifNull: [
                '$metadata.candidatesTokens',
                0
              ]
            }
          },

          totalTokens: {
            $sum: {
              $ifNull: [
                '$metadata.totalTokens',
                0
              ]
            }
          }
        }
      }
    ]);

    return {
      total: result?.total ?? 0,

      byStatus: {
        PENDING: result?.pending ?? 0,
        GENERATING: result?.generating ?? 0,
        IN_PROGRESS: result?.inProgress ?? 0,
        EVALUATING: result?.evaluating ?? 0,
        COMPLETED: result?.completed ?? 0,
        FAILED: result?.failed ?? 0
      },

      promptTokens: result?.promptTokens ?? 0,
      candidatesTokens: result?.candidatesTokens ?? 0,
      totalTokens: result?.totalTokens ?? 0
    };
  }
}