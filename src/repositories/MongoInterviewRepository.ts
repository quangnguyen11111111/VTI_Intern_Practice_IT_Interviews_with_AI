import {
  IInterviewRepository,
  InterviewEntity,
  InterviewQuestionEntity,
  InterviewPromptVersion,
} from './IInterviewRepository';

import {
  IInterviewHistoryRepository,
  InterviewHistoryQuery,
  InterviewHistoryResult
} from './interfaces/IInterviewHistoryRepository';

import {
  IInterviewAnalyticsRepository,
  InterviewAnalyticsQuery,
  InterviewAnalyticsResult
} from './interfaces/IInterviewAnalyticsRepository';

import {
  InterviewStatus
} from '../domain/interview/IInterviewState';

import {
  InterviewSetupPayload,
  LocalizedContent
} from '../domain/interview/types';

import {
  InterviewSessionModel
} from '../models/InterviewSession';

import {
  InterviewQuestionModel
} from '../models/InterviewQuestion';

export class MongoInterviewRepository
  implements
    IInterviewRepository,
    IInterviewHistoryRepository,
    IInterviewAnalyticsRepository
{
  async create(
    data: InterviewSetupPayload,
    userId?: string
  ): Promise<InterviewEntity> {
    const newSession =
      await InterviewSessionModel.create({
        userId,
        status: 'PENDING',
        setupData: data
      });

    return this.mapToEntity(newSession);
  }

  async findHistory(
    userId: string,
    query: InterviewHistoryQuery
  ): Promise<InterviewHistoryResult> {
    const filter: Record<string, unknown> = {
      userId
    };

    if (query.role) {
      filter['setupData.jobPosition'] = query.role;
    }

    if (query.level) {
      filter['setupData.level'] = query.level;
    }

    if (query.technology) {
      filter['setupData.techStacks'] = query.technology;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lt: query.to } : {})
      };
    }

    const skip =
      (query.page - 1) * query.limit;

    const sortDirection =
      query.sort === 'oldest' ? 1 : -1;

    const [sessions, total] =
      await Promise.all([
        InterviewSessionModel
          .find(filter)
          .select({
            _id: 1,
            'setupData.jobPosition': 1,
            'setupData.level': 1,
            'setupData.techStacks': 1,
            overallScore: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1
          })
          .sort({
            createdAt: sortDirection,
            _id: sortDirection
          })
          .skip(skip)
          .limit(query.limit)
          .lean(),
        InterviewSessionModel.countDocuments(filter)
      ]);

    return {
      items: sessions.map((session: any) => ({
        sessionId: session._id.toString(),
        role: session.setupData?.jobPosition,
        level: session.setupData?.level,
        technologies: Array.isArray(
          session.setupData?.techStacks
        )
          ? session.setupData.techStacks
          : [],
        score: session.overallScore ?? null,
        status: session.status as InterviewStatus,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt
      })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(
          total / query.limit
        )
      }
    };
  }

  async getAnalytics(
    userId: string,
    query: InterviewAnalyticsQuery
  ): Promise<InterviewAnalyticsResult> {
    const match: Record<string, unknown> = {
      userId,
      status: 'COMPLETED',
      overallScore: {
        $gte: 0,
        $lte: 10
      }
    };

    if (query.role) {
      match['setupData.jobPosition'] = query.role;
    }

    if (query.level) {
      match['setupData.level'] = query.level;
    }

    if (query.technology) {
      match['setupData.techStacks'] = query.technology;
    }

    if (query.from || query.to) {
      match.createdAt = {
        ...(query.from
          ? { $gte: query.from }
          : {}),
        ...(query.to
          ? { $lt: query.to }
          : {})
      };
    }

    const dimensionNames = [
      'Technical Depth',
      'Problem Solving',
      'System Design & Best Practices',
      'Communication',
      'Practical Experience'
    ];

    type AnalyticsAggregation = {
      summaryOverall: Array<{
        totalCompleted: number;
        averageOverallScore: number | null;
      }>;

      summaryDimensions: Array<{
        _id: string;
        score: number | null;
      }>;

      dailyOverall: Array<{
        _id: string;
        overallScore: number | null;
      }>;

      dailyDimensions: Array<{
        _id: {
          date: string;
          name: string;
        };
        score: number | null;
      }>;
    };

    const [aggregation] =
      await InterviewSessionModel.aggregate<AnalyticsAggregation>([
        {
          $match: match
        },

        {
          $set: {
            bucketDate: {
              $dateToString: {
                date: '$createdAt',
                format: '%Y-%m-%d',
                timezone: 'UTC'
              }
            }
          }
        },

        {
          $facet: {
            summaryOverall: [
              {
                $group: {
                  _id: null,
                  totalCompleted: {
                    $sum: 1
                  },
                  averageOverallScore: {
                    $avg: '$overallScore'
                  }
                }
              }
            ],

            summaryDimensions: [
              {
                $unwind: '$dimensions'
              },

              {
                $match: {
                  'dimensions.name': {
                    $in: dimensionNames
                  },
                  'dimensions.score': {
                    $gte: 0,
                    $lte: 10
                  }
                }
              },

              {
                $group: {
                  _id: '$dimensions.name',
                  score: {
                    $avg: '$dimensions.score'
                  }
                }
              }
            ],

            dailyOverall: [
              {
                $group: {
                  _id: '$bucketDate',
                  overallScore: {
                    $avg: '$overallScore'
                  }
                }
              },

              {
                $sort: {
                  _id: 1
                }
              }
            ],

            dailyDimensions: [
              {
                $unwind: '$dimensions'
              },

              {
                $match: {
                  'dimensions.name': {
                    $in: dimensionNames
                  },
                  'dimensions.score': {
                    $gte: 0,
                    $lte: 10
                  }
                }
              },

              {
                $group: {
                  _id: {
                    date: '$bucketDate',
                    name: '$dimensions.name'
                  },
                  score: {
                    $avg: '$dimensions.score'
                  }
                }
              },

              {
                $sort: {
                  '_id.date': 1,
                  '_id.name': 1
                }
              }
            ]
          }
        }
      ]);

    const round = (
      value: number | null | undefined
    ): number | null =>
      typeof value === 'number'
        ? Number(value.toFixed(2))
        : null;

    const summaryOverall =
      aggregation?.summaryOverall?.[0];

    const summaryDimensions =
      new Map<string, number | null>(
        (
          aggregation?.summaryDimensions ?? []
        ).map(
          (
            item: {
              _id: string;
              score: number | null;
            }
          ) => [
            item._id,
            round(item.score)
          ]
        )
      );

    const dailyOverall =
      new Map<string, number | null>(
        (
          aggregation?.dailyOverall ?? []
        ).map(
          (
            item: {
              _id: string;
              overallScore: number | null;
            }
          ) => [
            item._id,
            round(item.overallScore)
          ]
        )
      );

    const dailyDimensions =
      new Map<
        string,
        Map<string, number | null>
      >();

    for (
      const item of
        aggregation?.dailyDimensions ?? []
    ) {
      const date = item._id.date;

      const dimensions =
        dailyDimensions.get(date) ??
        new Map<string, number | null>();

      dimensions.set(
        item._id.name,
        round(item.score)
      );

      dailyDimensions.set(
        date,
        dimensions
      );
    }

    const dates = Array.from(
      new Set([
        ...dailyOverall.keys(),
        ...dailyDimensions.keys()
      ])
    ).sort();

    return {
      summary: {
        totalCompleted:
          summaryOverall?.totalCompleted ?? 0,

        averageOverallScore:
          round(
            summaryOverall?.averageOverallScore
          ),

        dimensions:
          dimensionNames.map((name) => ({
            name,
            score:
              summaryDimensions.get(name) ??
              null
          }))
      },

      series: dates.map((date) => {
        const dimensions =
          dailyDimensions.get(date);

        return {
          date,

          overallScore:
            dailyOverall.get(date) ?? 0,

          dimensions:
            dimensionNames.map((name) => ({
              name,
              score:
                dimensions?.get(name) ??
                null
            }))
        };
      })
    };
  }

  async findById(
    id: string
  ): Promise<InterviewEntity | null> {
    const session =
      await InterviewSessionModel
        .findById(id)
        .lean();

    if (!session) {
      return null;
    }

    const questions =
      await InterviewQuestionModel
        .find({
          sessionId: id
        })
        .sort({
          order: 1
        })
        .lean();

    const entity =
      this.mapToEntity(session);

    entity.questions =
      questions.map((question) =>
        this.mapQuestionToEntity(question)
      );

    return entity;
  }

  async updateStatus(
    id: string,
    status: InterviewStatus
  ): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(
      id,
      {
        status
      }
    );
  }

  async update(
    id: string,
    data: Partial<InterviewEntity>
  ): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(
      id,
      {
        $set: data
      }
    );
  }

  async createQuestions(
    sessionId: string,
    questionsData: Omit<
      InterviewQuestionEntity,
      | 'id'
      | 'sessionId'
      | 'createdAt'
      | 'updatedAt'
      | 'candidateAnswer'
      | 'feedback'
      | 'score'
    >[]
  ): Promise<InterviewQuestionEntity[]> {
    const docs =
      questionsData.map((question) => ({
        sessionId,
        order: question.order,
        difficulty: question.difficulty,
        content: question.content,
        candidateAnswer: null,
        feedback: null,
        score: null
      }));

    const created =
      await InterviewQuestionModel.insertMany(
        docs
      );

    return created.map((question) =>
      this.mapQuestionToEntity(question)
    );
  }

  async updateQuestionAnswer(
    questionId: string,
    answer: string
  ): Promise<void> {
    await InterviewQuestionModel.findByIdAndUpdate(
      questionId,
      {
        candidateAnswer: answer
      }
    );
  }

  async updateQuestionFeedback(
    questionId: string,
    feedback: LocalizedContent,
    score: number
  ): Promise<void> {
    await InterviewQuestionModel.findByIdAndUpdate(
      questionId,
      {
        feedback,
        score
      }
    );
  }

  async updateTokenUsage(
    id: string,
    usage: import('../domain/interview/types').AiUsageMetadata
  ): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(
      id,
      {
        $inc: {
          'metadata.promptTokens':
            usage.promptTokenCount,

          'metadata.candidatesTokens':
            usage.candidatesTokenCount,

          'metadata.totalTokens':
            usage.totalTokenCount
        }
      }
    );
  }

  async updatePromptVersion(
    id: string,
    type:
      | 'generation'
      | 'evaluation'
      | 'learningPath',
    promptVersion: InterviewPromptVersion
  ): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(
      id,
      {
        $set: {
          [`promptVersions.${type}`]:
            promptVersion
        }
      }
    );
  }

  private mapToEntity(
    doc: any
  ): InterviewEntity {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      status:
        doc.status as InterviewStatus,
      setupData: doc.setupData,
      overallScore: doc.overallScore,
      dimensions: doc.dimensions,
      learningPath: doc.learningPath,
      promptVersions:
        doc.promptVersions,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  private mapQuestionToEntity(
    doc: any
  ): InterviewQuestionEntity {
    return {
      id: doc._id.toString(),
      sessionId:
        doc.sessionId.toString(),
      order: doc.order,
      difficulty: doc.difficulty,
      content: doc.content,
      candidateAnswer:
        doc.candidateAnswer,
      feedback: doc.feedback,
      score: doc.score,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }
}