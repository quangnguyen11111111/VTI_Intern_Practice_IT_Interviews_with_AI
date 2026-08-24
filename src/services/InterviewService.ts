import { injectable, inject } from 'tsyringe';
import { IInterviewRepository } from '../repositories/IInterviewRepository';
import { InterviewContext } from '../domain/interview/InterviewContext';
import { InterviewSetupPayload, AnswerPayload, IAiProvider } from '../domain/interview/types';

@injectable()
export class InterviewService {
  constructor(
    @inject('IInterviewRepository') private interviewRepo: IInterviewRepository,
    @inject('IAiProvider') private aiProvider: IAiProvider
  ) {}

  /**
   * Khởi tạo phiên phỏng vấn mới (Trạng thái mặc định: PENDING)
   */
  async createInterviewSession(setupData: InterviewSetupPayload, userId?: string) {
    const session = await this.interviewRepo.create(setupData, userId);
    return session;
  }

  /**
   * Lấy thông tin phiên
   */
  async getInterviewSession(id: string) {
    const session = await this.interviewRepo.findById(id);
    if (!session) {
      throw new Error('Interview session not found');
    }
    return session;
  }

  /**
   * Sinh câu hỏi (Chuyển trạng thái từ PENDING -> GENERATING)
   */
  async generateQuestions(id: string) {
    const sessionData = await this.getInterviewSession(id);
    
    // Phục hồi State Machine từ Database state
    const currentState = InterviewContext.createStateFromStatus(sessionData.status);
    const context = new InterviewContext(id, this.interviewRepo, currentState);

    if (!sessionData.setupData) {
      throw new Error('Setup data is missing from session');
    }

    await context.generate({
      setupData: sessionData.setupData,
      aiProvider: this.aiProvider
    });

    return await this.getInterviewSession(id);
  }

  /**
   * Nộp câu trả lời (Chuyển trạng thái từ IN_PROGRESS -> EVALUATING)
   */
  async submitAnswers(id: string, answers: AnswerPayload[]) {
    const sessionData = await this.getInterviewSession(id);
    
    // Cập nhật câu trả lời vào DB trước
    for (const ans of answers) {
      await this.interviewRepo.updateQuestionAnswer(ans.questionId, ans.candidateAnswer);
    }

    // Phục hồi State Machine
    const currentState = InterviewContext.createStateFromStatus(sessionData.status);
    const context = new InterviewContext(id, this.interviewRepo, currentState);

    // Kích hoạt action nộp bài
    await context.submit({
      data: answers,
      aiProvider: this.aiProvider
    });

    return await this.getInterviewSession(id);
  }
}
