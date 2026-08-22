import { IInterviewRepository, InterviewEntity } from './IInterviewRepository';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload } from '../domain/interview/types';

export class InterviewRepository implements IInterviewRepository {
  // Giả lập In-Memory Database
  private static store: Map<string, InterviewEntity> = new Map();

  async create(data: InterviewSetupPayload): Promise<InterviewEntity> {
    const id = Date.now().toString(); // Simple ID generation for mockup
    const newSession: InterviewEntity = {
      id,
      status: 'PENDING',
      setupData: data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    InterviewRepository.store.set(id, newSession);
    return newSession;
  }

  async findById(id: string): Promise<InterviewEntity | null> {
    return InterviewRepository.store.get(id) || null;
  }

  async updateStatus(id: string, status: InterviewStatus): Promise<void> {
    const session = await this.findById(id);
    if (session) {
      session.status = status;
      session.updatedAt = new Date();
      InterviewRepository.store.set(id, session);
    }
  }

  async update(id: string, data: Partial<InterviewEntity>): Promise<void> {
    const session = await this.findById(id);
    if (session) {
      Object.assign(session, data);
      session.updatedAt = new Date();
      InterviewRepository.store.set(id, session);
    }
  }
}
