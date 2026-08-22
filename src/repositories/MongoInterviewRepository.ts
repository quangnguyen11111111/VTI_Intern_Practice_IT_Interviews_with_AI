import { IInterviewRepository, InterviewEntity } from './IInterviewRepository';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload } from '../domain/interview/types';
import { InterviewModel } from '../models/Interview';

export class MongoInterviewRepository implements IInterviewRepository {
  
  async create(data: InterviewSetupPayload): Promise<InterviewEntity> {
    const newSession = await InterviewModel.create({
      status: 'PENDING',
      setupData: data
    });
    return this.mapToEntity(newSession);
  }

  async findById(id: string): Promise<InterviewEntity | null> {
    const session = await InterviewModel.findById(id).lean();
    if (!session) return null;
    return this.mapToEntity(session);
  }

  async updateStatus(id: string, status: InterviewStatus): Promise<void> {
    await InterviewModel.findByIdAndUpdate(id, { status });
  }

  async update(id: string, data: Partial<InterviewEntity>): Promise<void> {
    await InterviewModel.findByIdAndUpdate(id, { $set: data });
  }

  private mapToEntity(doc: any): InterviewEntity {
    return {
      id: doc._id.toString(),
      status: doc.status as InterviewStatus,
      setupData: doc.setupData,
      questions: doc.questions,
      answers: doc.answers,
      score: doc.score,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }
}
