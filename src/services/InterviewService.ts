import { injectable, inject } from 'tsyringe';
import { IInterviewRepository } from '../repositories/IInterviewRepository';
import { InterviewContext } from '../domain/interview/InterviewContext';
import { InterviewSetupPayload, AnswerPayload, IAiProvider } from '../domain/interview/types';
import mongoose from 'mongoose';
import Role from '../models/role.model';
import Level from '../models/level.model';
import Technology from '../models/technology.model';
import { AppError } from '../utils/AppError';
import { generationPrompt, evaluationPrompt, minimizeText } from './ai/prompt-security';

import { IJobScheduler } from '../domain/jobs/IJobScheduler';
import { IEventPublisher } from '../domain/events/IEventPublisher';

@injectable()
export class InterviewService {
  constructor(
    @inject('IInterviewRepository') private interviewRepo: IInterviewRepository,
    @inject('IAiProvider') private aiProvider: IAiProvider,
    @inject('IJobScheduler') private jobScheduler?: IJobScheduler,
    @inject('IEventPublisher') private eventPublisher?: IEventPublisher
  ) {}

  /**
   * Khởi tạo phiên phỏng vấn mới (Trạng thái mặc định: PENDING)
   */
  async createInterviewSession(setupData: InterviewSetupPayload, userId: string) {
    const session = await this.interviewRepo.forOwner(userId).create(generationPrompt(setupData).data, userId);
    return session;
  }

  /**
   * Khởi tạo phiên phỏng vấn mới từ file JD
   */
  async createInterviewSessionFromJD(
    setupData: Omit<InterviewSetupPayload, 'jdText'>, 
    fileBuffer: Buffer, 
    mimeType: string, 
    userId: string
  ) {
    const { FileParserFactory } = await import('../utils/parsers/FileParserFactory');
    let jdText: string;
    try {
      this.interviewRepo.forOwner(userId).getOwnerId();
      jdText = await FileParserFactory.getParser(mimeType).parse(fileBuffer);
    }
    finally { fileBuffer.fill(0); }
    
    // Giới hạn độ dài jdText để tránh payload quá lớn cho AI (ví dụ 10000 ký tự)
    const truncatedJdText = minimizeText(jdText).substring(0, 10000);

    const fullSetupData: InterviewSetupPayload = {
      ...setupData,
      jdText: truncatedJdText
    };

    return this.createInterviewSession(fullSetupData, userId);
  }

  /**
   * Lấy thông tin phiên
   */
  async getInterviewSession(id: string, userId: string) {
    const session = await this.interviewRepo.forOwner(userId).findById(id);
    if (!session) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
    }
    return session;
  }

  /**
   * Sinh câu hỏi (Chuyển trạng thái từ PENDING -> GENERATING)
   */
  async generateQuestions(id: string, userId: string) {
    const sessionData = await this.getInterviewSession(id, userId);
    
    // Phục hồi State Machine từ Database state
    const currentState = InterviewContext.createStateFromStatus(sessionData.status);
    const context = new InterviewContext(id, this.interviewRepo.forOwner(userId), currentState, this.eventPublisher);

    if (!sessionData.setupData) {
      throw new AppError('Setup data is missing from session', 500, 'INTERVIEW_SETUP_MISSING');
    }

    const aiSetupData = { ...sessionData.setupData };

    if (mongoose.Types.ObjectId.isValid(aiSetupData.jobPosition || '')) {
      const role = await Role.findById(aiSetupData.jobPosition);
      if (role) aiSetupData.jobPosition = role.name;
    }

    if (mongoose.Types.ObjectId.isValid(aiSetupData.level || '')) {
      const level = await Level.findById(aiSetupData.level);
      if (level) aiSetupData.level = level.name;
    }

    if (aiSetupData.techStacks && Array.isArray(aiSetupData.techStacks)) {
      const techNames = [];
      for (const techId of aiSetupData.techStacks) {
        if (mongoose.Types.ObjectId.isValid(techId)) {
          const tech = await Technology.findById(techId);
          if (tech) techNames.push(tech.name);
          else techNames.push(techId);
        } else {
          techNames.push(techId);
        }
      }
      aiSetupData.techStacks = techNames;
    }

    await context.generate({
      setupData: aiSetupData,
      aiProvider: this.aiProvider,
      jobScheduler: this.jobScheduler
    });

    return await this.getInterviewSession(id, userId);
  }

  /**
   * Nộp câu trả lời (Chuyển trạng thái từ IN_PROGRESS -> EVALUATING)
   */
  async submitAnswers(id: string, answers: AnswerPayload[], userId: string) {
    const sessionData = await this.getInterviewSession(id, userId);
    if (sessionData.status !== 'IN_PROGRESS') throw new AppError('Invalid interview state', 409, 'STATE_CONFLICT');
    evaluationPrompt(sessionData.questions ?? [], answers);
    
    // Cập nhật câu trả lời vào DB trước
    for (const ans of answers) {
      await this.interviewRepo.forOwner(userId).updateQuestionAnswer(ans.questionId, ans.candidateAnswer, id);
    }

    // Phục hồi State Machine
    const currentState = InterviewContext.createStateFromStatus(sessionData.status);
    const context = new InterviewContext(id, this.interviewRepo.forOwner(userId), currentState, this.eventPublisher);

    // Kích hoạt action nộp bài
    await context.submit({
      data: answers,
      aiProvider: this.aiProvider,
      jobScheduler: this.jobScheduler
    });

    return await this.getInterviewSession(id, userId);
  }

  /**
   * Lưu tiến trình (Autosave)
   */
  async saveProgress(id: string, answers: AnswerPayload[], userId: string) {
    const sessionData = await this.getInterviewSession(id, userId);
    evaluationPrompt(sessionData.questions ?? [], answers);
    
    // Phục hồi State Machine
    const currentState = InterviewContext.createStateFromStatus(sessionData.status);
    const context = new InterviewContext(id, this.interviewRepo.forOwner(userId), currentState);

    // Kích hoạt action lưu tiến trình
    await context.saveProgress({
      answers
    });

    return { message: 'Progress saved successfully' };
  }
}
