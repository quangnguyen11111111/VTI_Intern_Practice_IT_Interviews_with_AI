import { IInterviewRepository } from '../repositories/IInterviewRepository';
import { InterviewContext } from '../domain/interview/InterviewContext';
import { InterviewSetupPayload } from '../domain/interview/types';

// Giả lập AI Service để inject
const mockAiService = {
  generateQuestions: async (interviewId: string, setupData: InterviewSetupPayload) => {
    console.log(`[MockAI] Generating questions for ${interviewId} with data:`, setupData);
    // Simulate background work...
    return new Promise<void>(resolve => setTimeout(resolve, 2000));
  },
  evaluateAnswers: async (interviewId: string, answers: unknown[]) => {
    console.log(`[MockAI] Evaluating answers for ${interviewId}`);
    return new Promise<void>(resolve => setTimeout(resolve, 2000));
  }
};

export class InterviewService {
  constructor(private interviewRepo: IInterviewRepository) {}

  /**
   * Khởi tạo phiên phỏng vấn mới (Trạng thái mặc định: PENDING)
   */
  async createInterviewSession(setupData: InterviewSetupPayload) {
    const session = await this.interviewRepo.create(setupData);
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

    // Kích hoạt hành động sinh đề. State Machine sẽ ném lỗi nếu không hợp lệ
    // Inject dependencies cần thiết vào payload
    if (!sessionData.setupData) {
      throw new Error('Setup data is missing from session');
    }

    await context.generate({
      setupData: sessionData.setupData,
      aiService: mockAiService 
    });

    // Lúc này trạng thái đã là GENERATING, ta có thể trả về cho Client biết
    return await this.getInterviewSession(id);
  }

  /**
   * Nộp câu trả lời (Chuyển trạng thái từ IN_PROGRESS -> EVALUATING)
   */
  async submitAnswers(id: string, answers: unknown[]) {
    const sessionData = await this.getInterviewSession(id);
    
    // Cập nhật câu trả lời vào DB trước
    await this.interviewRepo.update(id, { answers });

    // Phục hồi State Machine
    const currentState = InterviewContext.createStateFromStatus(sessionData.status);
    const context = new InterviewContext(id, this.interviewRepo, currentState);

    // Kích hoạt action nộp bài
    await context.submit({
      data: answers,
      aiService: mockAiService
    });

    return await this.getInterviewSession(id);
  }
}
