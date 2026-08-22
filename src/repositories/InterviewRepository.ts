import { IInterviewRepository, InterviewEntity, InterviewQuestionEntity } from './IInterviewRepository';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload, LocalizedContent } from '../domain/interview/types';

export class InterviewRepository implements IInterviewRepository {
  // Giả lập In-Memory Database
  private static sessionStore: Map<string, InterviewEntity> = new Map();
  private static questionStore: Map<string, InterviewQuestionEntity[]> = new Map();

  async create(data: InterviewSetupPayload, userId?: string): Promise<InterviewEntity> {
    const id = Date.now().toString(); // Simple ID generation for mockup
    const newSession: InterviewEntity = {
      id,
      userId,
      status: 'PENDING',
      setupData: data,
      createdAt: new Date(),
      updatedAt: new Date(),
      questions: []
    };
    InterviewRepository.sessionStore.set(id, newSession);
    InterviewRepository.questionStore.set(id, []);
    return newSession;
  }

  async findById(id: string): Promise<InterviewEntity | null> {
    const session = InterviewRepository.sessionStore.get(id);
    if (!session) return null;
    
    // Deep clone to avoid mutating the store directly
    const sessionCopy = JSON.parse(JSON.stringify(session));
    sessionCopy.questions = InterviewRepository.questionStore.get(id) || [];
    return sessionCopy;
  }

  async updateStatus(id: string, status: InterviewStatus): Promise<void> {
    const session = InterviewRepository.sessionStore.get(id);
    if (session) {
      session.status = status;
      session.updatedAt = new Date();
    }
  }

  async update(id: string, data: Partial<InterviewEntity>): Promise<void> {
    const session = InterviewRepository.sessionStore.get(id);
    if (session) {
      Object.assign(session, data);
      session.updatedAt = new Date();
    }
  }

  async createQuestions(sessionId: string, questionsData: Omit<InterviewQuestionEntity, 'id' | 'sessionId' | 'createdAt' | 'updatedAt' | 'candidateAnswer' | 'feedback' | 'score'>[]): Promise<InterviewQuestionEntity[]> {
    const questions = questionsData.map((q, idx) => ({
      id: `${sessionId}-q${idx}`,
      sessionId,
      ...q,
      candidateAnswer: null,
      feedback: null,
      score: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    
    InterviewRepository.questionStore.set(sessionId, questions);
    return questions;
  }

  async updateQuestionAnswer(questionId: string, answer: string): Promise<void> {
    for (const [sessionId, questions] of InterviewRepository.questionStore.entries()) {
      const q = questions.find(q => q.id === questionId);
      if (q) {
        q.candidateAnswer = answer;
        q.updatedAt = new Date();
        break;
      }
    }
  }

  async updateQuestionFeedback(questionId: string, feedback: LocalizedContent, score: number): Promise<void> {
    for (const [sessionId, questions] of InterviewRepository.questionStore.entries()) {
      const q = questions.find(q => q.id === questionId);
      if (q) {
        q.feedback = feedback;
        q.score = score;
        q.updatedAt = new Date();
        break;
      }
    }
  }
}

