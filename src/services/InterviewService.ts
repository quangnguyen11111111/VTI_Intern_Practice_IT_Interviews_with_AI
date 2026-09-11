import { injectable, inject } from 'tsyringe';
import { IInterviewRepository } from '../repositories/IInterviewRepository';
import { InterviewContext } from '../domain/interview/InterviewContext';
import { InterviewSetupPayload, AnswerPayload, IAiProvider } from '../domain/interview/types';
import mongoose from 'mongoose';
import Role from '../models/role.model';
import Level from '../models/level.model';
import Technology from '../models/technology.model';
import { AppError } from '../utils/AppError';

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
    await this.validateSetupTaxonomy(setupData);
    const session = await this.interviewRepo.create(setupData, userId);
    return session;
  }

  private async validateSetupTaxonomy(setupData: InterviewSetupPayload): Promise<void> {
    if (setupData.strategy === 'ADAPTIVE') {
      throw new AppError('Chiến lược ADAPTIVE chưa được bật', 409, 'FEATURE_DISABLED');
    }

    const [role, level] = await Promise.all([
      Role.findOne({ _id: setupData.jobPosition, status: 'ACTIVE' }).lean(),
      Level.findOne({ _id: setupData.level, status: 'ACTIVE' }).lean(),
    ]);

    if (!role) {
      throw new AppError('Role không tồn tại hoặc không hoạt động', 400, 'SETUP_ROLE_INVALID');
    }
    if (!level) {
      throw new AppError('Level không tồn tại hoặc không hoạt động', 400, 'SETUP_LEVEL_INVALID');
    }

    const technologyIds = setupData.techStacks ?? [];
    const activeTechnologies = await Technology.countDocuments({
      _id: { $in: technologyIds },
      status: 'ACTIVE',
      roles: role._id,
    });

    if (activeTechnologies !== technologyIds.length) {
      throw new AppError(
        'Technology không tồn tại, không hoạt động hoặc không thuộc Role đã chọn',
        400,
        'SETUP_TECHNOLOGY_INVALID'
      );
    }
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
    const parser = FileParserFactory.getParser(mimeType);
    const jdText = await parser.parse(fileBuffer);
    
    // Giới hạn độ dài jdText để tránh payload quá lớn cho AI (ví dụ 10000 ký tự)
    const truncatedJdText = jdText.substring(0, 10000);

    const fullSetupData: InterviewSetupPayload = {
      ...setupData,
      jdText: truncatedJdText
    };

    return this.createInterviewSession(fullSetupData, userId);
  }

  /**
   * Lấy thông tin phiên
   */
  async getInterviewSession(id: string) {
    const session = await this.interviewRepo.findById(id);
    if (!session) {
      throw new AppError('Interview session not found', 404, 'INTERVIEW_NOT_FOUND');
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
    const context = new InterviewContext(
      id,
      this.interviewRepo,
      currentState,
      this.eventPublisher,
      sessionData.version
    );

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

    return await this.getInterviewSession(id);
  }

  /**
   * Nộp câu trả lời (Chuyển trạng thái từ IN_PROGRESS -> EVALUATING)
   */
  async submitAnswers(id: string, answers: AnswerPayload[]) {
    const sessionData = await this.getInterviewSession(id);
    
    // Phục hồi State Machine
    const currentState = InterviewContext.createStateFromStatus(sessionData.status);
    const context = new InterviewContext(
      id,
      this.interviewRepo,
      currentState,
      this.eventPublisher,
      sessionData.version
    );

    // Kích hoạt action nộp bài
    await context.submit({
      data: answers,
      aiProvider: this.aiProvider,
      jobScheduler: this.jobScheduler
    });

    return await this.getInterviewSession(id);
  }

  /**
   * Lưu tiến trình (Autosave)
   */
  async saveProgress(id: string, answers: AnswerPayload[]) {
    const sessionData = await this.getInterviewSession(id);
    
    // Phục hồi State Machine
    const currentState = InterviewContext.createStateFromStatus(sessionData.status);
    const context = new InterviewContext(id, this.interviewRepo, currentState, undefined, sessionData.version);

    // Kích hoạt action lưu tiến trình
    await context.saveProgress({
      answers
    });

    return { message: 'Progress saved successfully' };
  }
}
