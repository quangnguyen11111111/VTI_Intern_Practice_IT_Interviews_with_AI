import { IInterviewRepository } from '../repositories/IInterviewRepository';
import { InterviewContext } from '../domain/interview/InterviewContext';
import { InterviewSetupPayload, AnswerPayload, LocalizedContent } from '../domain/interview/types';

export class InterviewService {
  constructor(private interviewRepo: IInterviewRepository) {}

  private mockAiService = {
    generateQuestions: async (interviewId: string, setupData: InterviewSetupPayload) => {
      console.log(`[MockAI] Generating questions for ${interviewId} with data:`, setupData);
      // Simulate background work...
      await new Promise<void>(resolve => setTimeout(resolve, 2000));
      
      // Save generated questions to DB
      await this.interviewRepo.createQuestions(interviewId, [
        {
          order: 1,
          difficulty: 'Easy',
          content: { en: 'What is a variable?', vi: 'Biến là gì?' }
        },
        {
          order: 2,
          difficulty: 'Medium',
          content: { en: 'Explain closure in JavaScript.', vi: 'Giải thích closure trong JavaScript.' }
        }
      ]);
    },
    evaluateAnswers: async (interviewId: string, answers: AnswerPayload[]) => {
      console.log(`[MockAI] Evaluating answers for ${interviewId}`);
      await new Promise<void>(resolve => setTimeout(resolve, 2000));
      
      // Save feedback to DB
      for (const ans of answers) {
        const feedback: LocalizedContent = {
          en: `Feedback for answer: ${ans.candidateAnswer}`,
          vi: `Nhận xét cho câu trả lời: ${ans.candidateAnswer}`
        };
        const score = Math.floor(Math.random() * 10) + 1; // Random score 1-10
        await this.interviewRepo.updateQuestionFeedback(ans.questionId, feedback, score);
      }
      
      // Update overall score
      await this.interviewRepo.update(interviewId, { overallScore: 8 }); // Mock overall score
    }
  };

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
      aiService: this.mockAiService 
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
      aiService: this.mockAiService
    });

    return await this.getInterviewSession(id);
  }
}

