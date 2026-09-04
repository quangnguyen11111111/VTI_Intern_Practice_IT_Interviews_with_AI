import {
  injectable,
  inject
} from 'tsyringe';

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
      promptId:
        String(prompt._id),
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
   * Trả undefined nếu project chưa có prompt loại này.
   * Điều này giúp giữ backward compatibility với
   * các interview flow cũ.
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
        currentState
      );

    if (!sessionData.setupData) {
      throw new Error(
        'Setup data is missing from session'
      );
    }

    const systemPrompt =
      await this.getGenerationPrompt();

    await context.generate({
      setupData:
        sessionData.setupData,

      aiProvider:
        this.aiProvider,

      systemPrompt
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

    /*
     * Lưu câu trả lời trước khi bắt đầu evaluation.
     */
    for (const answer of answers) {
      await this.interviewRepo
        .updateQuestionAnswer(
          answer.questionId,
          answer.candidateAnswer
        );
    }

    const currentState =
      InterviewContext.createStateFromStatus(
        sessionData.status
      );

    const context =
      new InterviewContext(
        id,
        this.interviewRepo,
        currentState
      );

    /*
     * Prompt bắt buộc cho evaluation.
     */
    const evaluationPrompt =
      await this.getEvaluationPrompt();

    /*
     * Prompt learning path là optional để
     * không phá interview flow cũ.
     */
    const learningPathPrompt =
      await this.getLearningPathPrompt();

    await context.submit({
      data: answers,

      aiProvider:
        this.aiProvider,

      systemPrompt:
        evaluationPrompt,

      learningPathPrompt
    });

    return this.getInterviewSession(id);
  }
}