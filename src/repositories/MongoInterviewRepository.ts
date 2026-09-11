import { IInterviewRepository, InterviewEntity, InterviewQuestionEntity } from './IInterviewRepository';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload, LocalizedContent } from '../domain/interview/types';
import { InterviewSessionModel } from '../models/InterviewSession';
import { InterviewQuestionModel } from '../models/InterviewQuestion';
import { AppError } from '../utils/AppError';
import { terminalUpdate } from '../services/retention-policy';

export class MongoInterviewRepository implements IInterviewRepository {
  constructor(private readonly ownerId?: string) {}
  forOwner(ownerId: string): IInterviewRepository {
    if (!/^[a-f0-9]{24}$/i.test(ownerId)) throw new AppError('Authentication required', 401, 'AUTH_UNAUTHORIZED');
    return new MongoInterviewRepository(ownerId);
  }
  getOwnerId(): string {
    if (!this.ownerId) throw new AppError('Owner scope required', 403, 'AUTH_FORBIDDEN');
    return this.ownerId;
  }
  private async assertSession(sessionId: string) {
    if (!await InterviewSessionModel.exists({ _id: sessionId, userId: this.getOwnerId() })) {
      throw new AppError('Access denied', 403, 'AUTH_FORBIDDEN');
    }
  }
  
  async create(data: InterviewSetupPayload, userId?: string): Promise<InterviewEntity> {
    if (userId !== this.getOwnerId()) throw new AppError('Access denied', 403, 'AUTH_FORBIDDEN');
    const newSession = await InterviewSessionModel.create({
      userId,
      status: 'PENDING',
      setupData: data
    });
    return this.mapToEntity(newSession);
  }

  async findById(id: string): Promise<InterviewEntity | null> {
    const session = await InterviewSessionModel.findOne({ _id: id, userId: this.getOwnerId() }).lean();
    if (!session) {
      if (await InterviewSessionModel.exists({ _id: id })) throw new AppError('Access denied', 403, 'AUTH_FORBIDDEN');
      return null;
    }
    
    // Fetch questions
    const questions = await InterviewQuestionModel.find({ sessionId: id }).sort({ order: 1 }).lean();
    
    const entity = this.mapToEntity(session);
    entity.questions = questions.map(q => this.mapQuestionToEntity(q));
    
    return entity;
  }

  async updateStatus(id: string, status: InterviewStatus): Promise<void> {
    await this.assertSession(id);
    await InterviewSessionModel.updateOne({ _id: id, userId: this.getOwnerId() }, terminalUpdate(status), { updatePipeline: true });
  }

  async update(id: string, data: Partial<InterviewEntity>): Promise<void> {
    await this.assertSession(id);
    const allowed = { overallScore: data.overallScore, dimensions: data.dimensions, learningPath: data.learningPath };
    await InterviewSessionModel.updateOne({ _id: id, userId: this.getOwnerId() }, { $set: allowed });
  }

  async createQuestions(sessionId: string, questionsData: Omit<InterviewQuestionEntity, 'id' | 'sessionId' | 'createdAt' | 'updatedAt' | 'candidateAnswer' | 'feedback' | 'score'>[]): Promise<InterviewQuestionEntity[]> {
    await this.assertSession(sessionId);
    const docs = questionsData.map(q => ({
      sessionId,
      ownerId: this.getOwnerId(),
      order: q.order,
      difficulty: q.difficulty,
      content: q.content,
      candidateAnswer: null,
      feedback: null,
      score: null
    }));
    
    const created = await InterviewQuestionModel.insertMany(docs);
    return created.map(q => this.mapQuestionToEntity(q));
  }

  async updateQuestionAnswer(questionId: string, answer: string, sessionId: string): Promise<void> {
    await this.assertSession(sessionId);
    const result = await InterviewQuestionModel.updateOne({ _id: questionId, sessionId }, { candidateAnswer: answer });
    if (!result.matchedCount) throw new AppError('Question not in session', 403, 'AUTH_FORBIDDEN');
  }

  async updateQuestionFeedback(questionId: string, feedback: LocalizedContent, score: number, sessionId: string): Promise<void> {
    await this.assertSession(sessionId);
    const result = await InterviewQuestionModel.updateOne({ _id: questionId, sessionId }, { feedback, score });
    if (!result.matchedCount) throw new AppError('Question not in session', 403, 'AUTH_FORBIDDEN');
  }

  async updateTokenUsage(id: string, usage: import('../domain/interview/types').AiUsageMetadata): Promise<void> {
    await this.assertSession(id);
    await InterviewSessionModel.updateOne({ _id: id, userId: this.getOwnerId() }, {
      $inc: {
        'metadata.promptTokens': usage.promptTokenCount,
        'metadata.candidatesTokens': usage.candidatesTokenCount,
        'metadata.totalTokens': usage.totalTokenCount,
      }
    });
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
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      terminalAt: doc.terminalAt, contentPurgeAt: doc.contentPurgeAt, recordPurgeAt: doc.recordPurgeAt
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
      updatedAt: doc.updatedAt
    };
  }
}

