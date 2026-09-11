import { IInterviewRepository, InterviewEntity, InterviewQuestionEntity } from './IInterviewRepository';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload, LocalizedContent } from '../domain/interview/types';
import { InterviewSessionModel } from '../models/InterviewSession';
import { InterviewQuestionModel } from '../models/InterviewQuestion';

export class MongoInterviewRepository implements IInterviewRepository {
  
  async create(data: InterviewSetupPayload, userId?: string): Promise<InterviewEntity> {
    const newSession = await InterviewSessionModel.create({
      userId,
      status: 'PENDING',
      setupData: data
    });
    return this.mapToEntity(newSession);
  }

  async findById(id: string): Promise<InterviewEntity | null> {
    const session = await InterviewSessionModel.findById(id).lean();
    if (!session) return null;
    
    // Fetch questions
    const questions = await InterviewQuestionModel.find({ sessionId: id }).sort({ order: 1 }).lean();
    
    const entity = this.mapToEntity(session);
    entity.questions = questions.map(q => this.mapQuestionToEntity(q));
    
    return entity;
  }

  async updateStatus(
    id: string,
    status: InterviewStatus,
    expectedStatus?: InterviewStatus,
    expectedVersion?: number
  ): Promise<number | null> {
    const filter: Record<string, unknown> = { _id: id };
    if (expectedStatus !== undefined) filter.status = expectedStatus;
    if (expectedVersion !== undefined) filter.version = expectedVersion;

    const updated = await InterviewSessionModel.findOneAndUpdate(
      filter,
      { $set: { status }, $inc: { version: 1 } },
      { returnDocument: 'after' }
    ).lean();

    return updated?.version ?? null;
  }

  async update(id: string, data: Partial<InterviewEntity>): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(id, { $set: data });
  }

  async createQuestions(sessionId: string, questionsData: Omit<InterviewQuestionEntity, 'id' | 'sessionId' | 'createdAt' | 'updatedAt' | 'candidateAnswer' | 'feedback' | 'score'>[]): Promise<InterviewQuestionEntity[]> {
    const docs = questionsData.map(q => ({
      sessionId,
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

  async updateQuestionAnswer(questionId: string, answer: string): Promise<void> {
    await InterviewQuestionModel.findByIdAndUpdate(questionId, { candidateAnswer: answer });
  }

  async updateQuestionFeedback(questionId: string, feedback: LocalizedContent, score: number): Promise<void> {
    await InterviewQuestionModel.findByIdAndUpdate(questionId, { feedback, score });
  }

  async updateTokenUsage(id: string, usage: import('../domain/interview/types').AiUsageMetadata): Promise<void> {
    await InterviewSessionModel.findByIdAndUpdate(id, {
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
      version: doc.version ?? 0,
      setupData: doc.setupData,
      overallScore: doc.overallScore,
      dimensions: doc.dimensions,
      learningPath: doc.learningPath,
      metadata: doc.metadata,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
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

