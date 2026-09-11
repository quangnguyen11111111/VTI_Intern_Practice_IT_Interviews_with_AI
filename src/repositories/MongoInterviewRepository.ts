import { IInterviewHistoryRepository, InterviewHistoryQuery, InterviewHistoryResult } from './interfaces/IInterviewHistoryRepository';
import { IInterviewRepository, InterviewEntity, InterviewPromptVersion, InterviewQuestionEntity } from './IInterviewRepository';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload, LocalizedContent } from '../domain/interview/types';
import { InterviewSessionModel } from '../models/InterviewSession';
import { InterviewQuestionModel } from '../models/InterviewQuestion';
import { AppError } from '../utils/AppError';
import { terminalUpdate } from '../services/retention-policy';

export class MongoInterviewRepository implements IInterviewRepository, IInterviewHistoryRepository {
  constructor(private readonly ownerId?: string) {}

  forOwner(ownerId: string): IInterviewRepository {
    if (!/^[a-f0-9]{24}$/i.test(ownerId)) {
      throw new AppError('Authentication required', 401, 'AUTH_UNAUTHORIZED');
    }
    return new MongoInterviewRepository(ownerId);
  }

  getOwnerId(): string {
    if (!this.ownerId) {
      throw new AppError('Owner scope required', 403, 'AUTH_FORBIDDEN');
    }
    return this.ownerId;
  }

  private async assertSession(sessionId: string): Promise<void> {
    if (!await InterviewSessionModel.exists({ _id: sessionId, userId: this.getOwnerId() })) {
      throw new AppError('Access denied', 403, 'AUTH_FORBIDDEN');
    }
  }

  async create(data: InterviewSetupPayload, userId?: string): Promise<InterviewEntity> {
    if (userId !== this.getOwnerId()) {
      throw new AppError('Access denied', 403, 'AUTH_FORBIDDEN');
    }
    const session = await InterviewSessionModel.create({ userId, status: 'PENDING', setupData: data });
    return this.mapToEntity(session);
  }

  async findById(id: string): Promise<InterviewEntity | null> {
    const session = await InterviewSessionModel.findOne({ _id: id, userId: this.getOwnerId() }).lean();
    if (!session) {
      if (await InterviewSessionModel.exists({ _id: id })) {
        throw new AppError('Access denied', 403, 'AUTH_FORBIDDEN');
      }
      return null;
    }

    const questions = await InterviewQuestionModel.find({ sessionId: id }).sort({ order: 1 }).lean();
    const entity = this.mapToEntity(session);
    entity.questions = questions.map((question) => this.mapQuestionToEntity(question));
    return entity;
  }

  async findHistory(userId: string, query: InterviewHistoryQuery): Promise<InterviewHistoryResult> {
    if (!/^[a-f0-9]{24}$/i.test(userId)) {
      throw new AppError('Authentication required', 401, 'AUTH_UNAUTHORIZED');
    }
    const filter: Record<string, unknown> = { userId };
    if (query.role) filter['setupData.jobPosition'] = query.role;
    if (query.level) filter['setupData.level'] = query.level;
    if (query.technology) filter['setupData.techStacks'] = query.technology;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.createdAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lt: query.to } : {}),
      };
    }

    const skip = (query.page - 1) * query.limit;
    const sortDirection = query.sort === 'oldest' ? 1 : -1;
    const [sessions, total] = await Promise.all([
      InterviewSessionModel.find(filter)
        .select({
          _id: 1,
          'setupData.jobPosition': 1,
          'setupData.level': 1,
          'setupData.techStacks': 1,
          overallScore: 1,
          status: 1,
          createdAt: 1,
          updatedAt: 1,
        })
        .sort({ createdAt: sortDirection, _id: sortDirection })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      InterviewSessionModel.countDocuments(filter),
    ]);

    return {
      items: sessions.map((session: any) => ({
        sessionId: session._id.toString(),
        role: session.setupData?.jobPosition,
        level: session.setupData?.level,
        technologies: Array.isArray(session.setupData?.techStacks) ? session.setupData.techStacks : [],
        score: session.overallScore ?? null,
        status: session.status as InterviewStatus,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async updateStatus(id: string, status: InterviewStatus): Promise<void> {
    await this.assertSession(id);
    await InterviewSessionModel.updateOne(
      { _id: id, userId: this.getOwnerId() },
      terminalUpdate(status),
      { updatePipeline: true },
    );
  }

  async update(id: string, data: Partial<InterviewEntity>): Promise<void> {
    await this.assertSession(id);
    const allowed: Record<string, unknown> = {};
    for (const key of ['overallScore', 'dimensions', 'learningPath'] as const) {
      if (data[key] !== undefined) allowed[key] = data[key];
    }
    if (Object.keys(allowed).length > 0) {
      await InterviewSessionModel.updateOne(
        { _id: id, userId: this.getOwnerId() },
        { $set: allowed },
      );
    }
  }

  async updateTokenUsage(id: string, usage: import('../domain/interview/types').AiUsageMetadata): Promise<void> {
    await this.assertSession(id);
    await InterviewSessionModel.updateOne(
      { _id: id, userId: this.getOwnerId() },
      {
        $inc: {
          'metadata.promptTokens': usage.promptTokenCount,
          'metadata.candidatesTokens': usage.candidatesTokenCount,
          'metadata.totalTokens': usage.totalTokenCount,
        },
      },
    );
  }

  async updatePromptVersion(id: string, type: 'generation' | 'evaluation' | 'learningPath', promptVersion: InterviewPromptVersion): Promise<void> {
    await this.assertSession(id);
    await InterviewSessionModel.updateOne(
      { _id: id, userId: this.getOwnerId() },
      { $set: { [`promptVersions.${type}`]: promptVersion } },
    );
  }

  async createQuestions(
    sessionId: string,
    questionsData: Omit<InterviewQuestionEntity, 'id' | 'sessionId' | 'createdAt' | 'updatedAt' | 'candidateAnswer' | 'feedback' | 'score'>[],
  ): Promise<InterviewQuestionEntity[]> {
    await this.assertSession(sessionId);
    const docs = questionsData.map((question) => ({
      sessionId,
      ownerId: this.getOwnerId(),
      order: question.order,
      difficulty: question.difficulty,
      content: question.content,
      candidateAnswer: null,
      feedback: null,
      score: null,
    }));
    const created = await InterviewQuestionModel.insertMany(docs);
    return created.map((question) => this.mapQuestionToEntity(question));
  }

  async updateQuestionAnswer(questionId: string, answer: string, sessionId?: string): Promise<void> {
    const resolvedSessionId = sessionId ?? String((await InterviewQuestionModel.findById(questionId).select({ sessionId: 1 }).lean())?.sessionId ?? '');
    await this.assertSession(resolvedSessionId);
    const result = await InterviewQuestionModel.updateOne(
      { _id: questionId, sessionId: resolvedSessionId },
      { candidateAnswer: answer },
    );
    if (!result.matchedCount) throw new AppError('Question not in session', 403, 'AUTH_FORBIDDEN');
  }

  async updateQuestionFeedback(questionId: string, feedback: LocalizedContent, score: number, sessionId?: string): Promise<void> {
    const resolvedSessionId = sessionId ?? String((await InterviewQuestionModel.findById(questionId).select({ sessionId: 1 }).lean())?.sessionId ?? '');
    await this.assertSession(resolvedSessionId);
    const result = await InterviewQuestionModel.updateOne(
      { _id: questionId, sessionId: resolvedSessionId },
      { feedback, score },
    );
    if (!result.matchedCount) throw new AppError('Question not in session', 403, 'AUTH_FORBIDDEN');
  }

  private mapToEntity(doc: any): InterviewEntity {
    return {
      id: doc._id.toString(),
      userId: doc.userId,
      status: doc.status as InterviewStatus,
      setupData: doc.setupData,
      overallScore: doc.overallScore,
      dimensions: doc.dimensions,
      learningPath: doc.learningPath,
      promptVersions: doc.promptVersions,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      terminalAt: doc.terminalAt,
      contentPurgeAt: doc.contentPurgeAt,
      recordPurgeAt: doc.recordPurgeAt,
    };
  }

  private mapQuestionToEntity(doc: any): InterviewQuestionEntity {
    return {
      id: doc._id.toString(),
      sessionId: doc.sessionId.toString(),
      order: doc.order,
      difficulty: doc.difficulty,
      content: doc.content,
      candidateAnswer: doc.candidateAnswer,
      feedback: doc.feedback,
      score: doc.score,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
