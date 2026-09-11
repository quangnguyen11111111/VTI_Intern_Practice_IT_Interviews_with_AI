import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { InterviewService } from '../services/InterviewService';
import { IEventPublisher } from '../domain/events/IEventPublisher';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';

@injectable()
export class InterviewController {
  constructor(
    @inject(InterviewService) private interviewService: InterviewService,
    @inject('IEventPublisher') private eventPublisher?: IEventPublisher
  ) {}

  /**
   * GET /api/interviews/:id/stream
   * Stream interview state changes via SSE
   */
  streamStatus = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    // Resolve ownership before sending headers; Express 5 forwards rejected async handlers.
    const ownedSession = await this.interviewService.getInterviewSession(id, req.user!._id.toString());
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE connection

    // Send initial status immediately
    try {
      const session = ownedSession;
      res.write(`data: ${JSON.stringify({ status: session.status })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
      res.end();
      return;
    }

    const listener = (payload: any) => {
      if (payload.interviewId === id) {
        res.write(`data: ${JSON.stringify({ status: payload.status })}\n\n`);
      }
    };

    if (this.eventPublisher) {
      this.eventPublisher.subscribe('STATE_CHANGED', listener);
    }

    req.on('close', () => {
      if (this.eventPublisher) {
        this.eventPublisher.unsubscribe('STATE_CHANGED', listener);
      }
      res.end();
    });
  };

  /**
   * POST /api/interviews
   */
  createSession = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { jobPosition, level, techStacks } = req.body;
    const userId = req.user!._id.toString();
    const setupData = { jobPosition, level, techStacks };
    const session = await this.interviewService.createInterviewSession(setupData, userId);
    res.status(201).json({ success: true, data: session });
  });

  /**
   * POST /api/interviews/generate-from-jd
   */
  createSessionFromJD = catchAsync(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      throw new AppError('JD file is required', 400, 'JD_FILE_REQUIRED');
    }

    const { jobPosition, level, techStacks } = req.body;
    const userId = req.user!._id.toString();
    const setupData = { jobPosition, level, techStacks };

    try {
      const session = await this.interviewService.createInterviewSessionFromJD(
        setupData, req.file.buffer, req.file.mimetype, userId
      );
      res.status(201).json({ success: true, data: session });
    } finally { req.file.buffer.fill(0); req.file = undefined; }
  });

  /**
   * GET /api/interviews/:id
   */
  getSession = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const session = await this.interviewService.getInterviewSession(id, req.user!._id.toString());
    res.status(200).json({ success: true, data: session });
  });

  /**
   * POST /api/interviews/:id/generate
   */
  generateQuestions = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const result = await this.interviewService.generateQuestions(id, req.user!._id.toString());
    res.status(200).json({ success: true, data: result });
  });

  /**
   * POST /api/interviews/:id/submit
   */
  submitAnswers = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { answers } = req.body;
    const result = await this.interviewService.submitAnswers(id, answers, req.user!._id.toString());
    res.status(200).json({ success: true, data: result });
  });
  /**
   * POST /api/interviews/:id/progress
   */
  saveProgress = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { answers } = req.body;
    const result = await this.interviewService.saveProgress(id, answers, req.user!._id.toString());
    res.status(200).json({ success: true, data: result });
  });
}
