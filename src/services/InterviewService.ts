import {
  injectable,
  inject
} from 'tsyringe';

import mongoose from 'mongoose';

import {
  IInterviewRepository
} from '../repositories/IInterviewRepository';

import {
  InterviewContext
} from '../domain/interview/InterviewContext';

import {
  InterviewSetupPayload,
  AnswerPayload,
  IAiProvider,
  SystemPromptContext
} from '../domain/interview/types';

import Role from '../models/role.model';
import Level from '../models/level.model';
import Technology from '../models/technology.model';

import {
  IJobScheduler
} from '../domain/jobs/IJobScheduler';

import {
  IEventPublisher
} from '../domain/events/IEventPublisher';

import {
  ISystemPromptService
} from './interfaces/ISystemPromptService';

const SYSTEM_PROMPT_KEY = 'interview';

const DEFAULT_PROMPT_LANGUAGE = 'EN' as const;

@injectable()
export class InterviewService {
  constructor(
    @inject('IInterviewRepository')
    private readonly interviewRepo:
      IInterviewRepository,

    @inject('IAiProvider')
    private readonly aiProvider:
      IAiProvider,

    @inject('IJobScheduler')
    private readonly jobScheduler:
      IJobScheduler,

    @inject('IEventPublisher')
    private readonly eventPublisher:
      IEventPublisher,

    @inject('ISystemPromptService')
    private readonly systemPromptService:
      ISystemPromptService
  ) {}

  /**
   * Khởi tạo phiên phỏng vấn mới
   * (Trạng thái mặc định: PENDING)
   */
  async createInterviewSession(
    setupData: InterviewSetupPayload,
    userId?: string
  ) {
    const session =
      await this.interviewRepo.create(
        setupData,
        userId
      );

    return session;
  }

  /**
   * Khởi tạo phiên phỏng vấn mới từ file JD
   */
  async createInterviewSessionFromJD(
    setupData: Omit<
      InterviewSetupPayload,
      'jdText'
    >,
    fileBuffer: Buffer,
    mimeType: string,
    userId?: string
  ) {
    const {
      FileParserFactory
    } = await import(
      '../utils/parsers/FileParserFactory'
    );

    const parser =
      FileParserFactory.getParser(
        mimeType
      );

    const jdText =
      await parser.parse(fileBuffer);

    // Giới hạn độ dài jdText
    // để tránh payload quá lớn cho AI.
    const truncatedJdText =
      jdText.substring(0, 10000);

    const fullSetupData:
      InterviewSetupPayload = {
      ...setupData,
      jdText: truncatedJdText
    };

    return this.createInterviewSession(
      fullSetupData,
      userId
    );
  }

  /**
   * Lấy thông tin phiên
   */
  async getInterviewSession(
    id: string
  ) {
    const session =
      await this.interviewRepo.findById(id);

    if (!session) {
      throw new Error(
        'Interview session not found'
      );
    }

    return session;
  }

  /**
   * Convert SystemPrompt entity
   * thành context dùng cho AI provider.
   */
  private toPromptContext(
    prompt: {
      _id: unknown;
      content: string;
      version: number;
      language: 'EN' | 'VI';
    }
  ): SystemPromptContext {
    return {
      content: prompt.content,
      promptId: String(prompt._id),
      version: prompt.version,
      language: prompt.language
    };
  }

  /**
   * Lấy published GENERATION prompt.
   */
  private async getGenerationPrompt():
    Promise<SystemPromptContext> {
    const prompt =
      await this.systemPromptService.getPublished(
        SYSTEM_PROMPT_KEY,
        'GENERATION',
        DEFAULT_PROMPT_LANGUAGE
      );

    return this.toPromptContext(
      prompt
    );
  }

  /**
   * Lấy published EVALUATION prompt.
   */
  private async getEvaluationPrompt():
    Promise<SystemPromptContext> {
    const prompt =
      await this.systemPromptService.getPublished(
        SYSTEM_PROMPT_KEY,
        'EVALUATION',
        DEFAULT_PROMPT_LANGUAGE
      );

    return this.toPromptContext(
      prompt
    );
  }

  /**
   * Lấy published LEARNING_PATH prompt.
   *
   * Optional để không phá flow cũ nếu chưa có
   * prompt LEARNING_PATH trong database.
   */
  private async getLearningPathPrompt():
    Promise<SystemPromptContext | undefined> {
    try {
      const prompt =
        await this.systemPromptService.getPublished(
          SYSTEM_PROMPT_KEY,
          'LEARNING_PATH',
          DEFAULT_PROMPT_LANGUAGE
        );

      return this.toPromptContext(
        prompt
      );
    } catch (error: any) {
      if (
        error?.message ===
        'PUBLISHED_SYSTEM_PROMPT_NOT_FOUND'
      ) {
        return undefined;
      }

      throw error;
    }
  }

  /**
   * Chuẩn hóa dữ liệu setup trước khi gửi AI.
   *
   * main đã cho phép job/user request truyền
   * ObjectId của role, level và technology.
   * Chuyển các ID này thành tên để AI nhận được
   * dữ liệu có nghĩa.
   */
  private async resolveAiSetupData(
    setupData: InterviewSetupPayload
  ): Promise<InterviewSetupPayload> {
    const aiSetupData = {
      ...setupData
    };

    if (
      mongoose.Types.ObjectId.isValid(
        aiSetupData.jobPosition || ''
      )
    ) {
      const role =
        await Role.findById(
          aiSetupData.jobPosition
        );

      if (role) {
        aiSetupData.jobPosition =
          role.name;
      }
    }

    if (
      mongoose.Types.ObjectId.isValid(
        aiSetupData.level || ''
      )
    ) {
      const level =
        await Level.findById(
          aiSetupData.level
        );

      if (level) {
        aiSetupData.level =
          level.name;
      }
    }

    if (
      aiSetupData.techStacks &&
      Array.isArray(
        aiSetupData.techStacks
      )
    ) {
      const techNames: string[] = [];

      for (
        const techId of
          aiSetupData.techStacks
      ) {
        if (
          mongoose.Types.ObjectId.isValid(
            techId
          )
        ) {
          const tech =
            await Technology.findById(
              techId
            );

          if (tech) {
            techNames.push(
              tech.name
            );
          } else {
            techNames.push(
              techId
            );
          }
        } else {
          techNames.push(
            techId
          );
        }
      }

      aiSetupData.techStacks =
        techNames;
    }

    return aiSetupData;
  }

  /**
   * Sinh câu hỏi.
   *
   * PENDING -> GENERATING -> IN_PROGRESS
   */
  async generateQuestions(
    id: string
  ) {
    const sessionData =
      await this.getInterviewSession(id);

    const currentState =
      InterviewContext.createStateFromStatus(
        sessionData.status
      );

    const context =
      new InterviewContext(
        id,
        this.interviewRepo,
        currentState,
        this.eventPublisher
      );

    if (!sessionData.setupData) {
      throw new Error(
        'Setup data is missing from session'
      );
    }

    const aiSetupData =
      await this.resolveAiSetupData(
        sessionData.setupData
      );

    const systemPrompt =
      await this.getGenerationPrompt();

    await context.generate({
      setupData:
        aiSetupData,

      aiProvider:
        this.aiProvider,

      systemPrompt,

      jobScheduler:
        this.jobScheduler
    });

    return this.getInterviewSession(id);
  }

  /**
   * Nộp câu trả lời.
   *
   * IN_PROGRESS -> EVALUATING -> COMPLETED
   */
  async submitAnswers(
    id: string,
    answers: AnswerPayload[]
  ) {
    const sessionData =
      await this.getInterviewSession(id);

    const currentState =
      InterviewContext.createStateFromStatus(
        sessionData.status
      );

    const context =
      new InterviewContext(
        id,
        this.interviewRepo,
        currentState,
        this.eventPublisher
      );

    /*
     * Lấy published evaluation prompt.
     */
    const evaluationPrompt =
      await this.getEvaluationPrompt();

    /*
     * Lấy published learning-path prompt.
     * Optional nếu database chưa có prompt loại này.
     */
    const learningPathPrompt =
      await this.getLearningPathPrompt();

    await context.submit({
      data: answers,

      aiProvider:
        this.aiProvider,

      systemPrompt:
        evaluationPrompt,

      learningPathPrompt,

      jobScheduler:
        this.jobScheduler
    });

    return this.getInterviewSession(id);
  }

  /**
   * Lưu tiến trình (Autosave).
   */
  async saveProgress(
    id: string,
    answers: AnswerPayload[]
  ) {
    const sessionData =
      await this.getInterviewSession(id);

    const currentState =
      InterviewContext.createStateFromStatus(
        sessionData.status
      );

    const context =
      new InterviewContext(
        id,
        this.interviewRepo,
        currentState,
        this.eventPublisher
      );

    await context.saveProgress({
      answers
    });

    return {
      message:
        'Progress saved successfully'
    };
  }
}