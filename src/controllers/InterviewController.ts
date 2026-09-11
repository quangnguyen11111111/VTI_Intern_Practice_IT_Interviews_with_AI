import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { InterviewWorkflowService } from '../services/InterviewWorkflowService';
import { IEventPublisher } from '../domain/events/IEventPublisher';
import { AppError } from '../utils/AppError';
import { catchAsync } from '../utils/catchAsync';

@injectable()
export class InterviewController {
  constructor(
    @inject(InterviewWorkflowService) private interviewService: InterviewWorkflowService,
    @inject('IEventPublisher') private eventPublisher?: IEventPublisher
  ) {}

  /**
   * GET /api/interviews/:id/stream
   * Stream interview state changes via SSE
   */
  streamStatus = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const actorId = req.user!._id.toString();

    const current = await this.interviewService.getInterviewSession(id, actorId);

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE connection

    const writeStatus = (status: string, version: number, updatedAt?: Date) => {
      res.write(`event: session.status\nid: ${version}\ndata: ${JSON.stringify({
        sessionId: id,
        status,
        version,
        updatedAt
      })}\n\n`);
    };
    writeStatus(current.status, current.version, current.updatedAt);
    if (current.status === 'COMPLETED' || current.status === 'FAILED') {
      res.end();
      return;
    }

    const listener = (payload: any) => {
      if (payload.interviewId === id) {
        writeStatus(payload.status, payload.version, payload.updatedAt);
        if (payload.status === 'COMPLETED' || payload.status === 'FAILED') res.end();
      }
    };

    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20_000);

    if (this.eventPublisher) {
      this.eventPublisher.subscribe('STATE_CHANGED', listener);
    }

    req.on('close', () => {
      clearInterval(heartbeat);
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
    const setupData = { jobPosition, level, techStacks };
    const session = await this.interviewService.createInterviewSession(setupData, req.user!._id.toString());
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
    const setupData = { jobPosition, level, techStacks };

    const session = await this.interviewService.createInterviewSessionFromJD(
      setupData,
      req.file.buffer,
      req.file.mimetype,
      req.user!._id.toString()
    );

    res.status(201).json({ success: true, data: session });
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
    const result = await this.interviewService.generateQuestions(
      id,
      req.user!._id.toString(),
      req.get('Idempotency-Key')!
    );
    res.status(202).json({ success: true, data: result });
  });

  /**
   * POST /api/interviews/:id/submit
   */
  submitAnswers = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { expectedVersion, answers } = req.body;
    const result = await this.interviewService.submitAnswers(
      id,
      req.user!._id.toString(),
      req.get('Idempotency-Key')!,
      expectedVersion,
      answers
    );
    res.status(202).json({ success: true, data: result });
  });
  /**
   * POST /api/interviews/:id/progress
   */
  saveProgress = catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { expectedVersion, answers } = req.body;
    const result = await this.interviewService.saveProgress(
      id,
      req.user!._id.toString(),
      expectedVersion,
      answers
    );
    res.status(200).json({ success: true, data: result });
  });
}
