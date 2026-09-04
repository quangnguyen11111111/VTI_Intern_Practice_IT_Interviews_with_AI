import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { InterviewService } from '../services/InterviewService';
import { InvalidStateTransitionException } from '../domain/interview/exceptions/InvalidStateTransitionException';
import { IEventPublisher } from '../domain/events/IEventPublisher';

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
    
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE connection

    // Send initial status immediately
    try {
      const session = await this.interviewService.getInterviewSession(id);
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
  createSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobPosition, level, techStacks, userId } = req.body;
      const setupData = { jobPosition, level, techStacks };
      const session = await this.interviewService.createInterviewSession(setupData, userId);
      res.status(201).json({ success: true, data: session });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/interviews/generate-from-jd
   */
  createSessionFromJD = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'JD file is required' });
        return;
      }
      
      const { jobPosition, level, techStacks, userId } = req.body;
      
      // Parse techStacks which might be sent as string from FormData
      const parsedTechStacks = typeof techStacks === 'string' ? JSON.parse(techStacks) : techStacks;
      
      const setupData = { jobPosition, level, techStacks: parsedTechStacks || [] };
      
      const session = await this.interviewService.createInterviewSessionFromJD(
        setupData,
        req.file.buffer,
        req.file.mimetype,
        userId
      );
      
      res.status(201).json({ success: true, data: session });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * GET /api/interviews/:id
   */
  getSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const session = await this.interviewService.getInterviewSession(id);
      res.status(200).json({ success: true, data: session });
    } catch (error: any) {
      res.status(404).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/interviews/:id/generate
   */
  generateQuestions = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.interviewService.generateQuestions(id);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof InvalidStateTransitionException) {
        res.status(400).json({ success: false, message: error.message, errorType: 'InvalidState' });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  };

  /**
   * POST /api/interviews/:id/submit
   */
  submitAnswers = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { answers } = req.body;
      const result = await this.interviewService.submitAnswers(id, answers);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof InvalidStateTransitionException) {
        res.status(400).json({ success: false, message: error.message, errorType: 'InvalidState' });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  };
  /**
   * POST /api/interviews/:id/progress
   */
  saveProgress = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = req.params.id as string;
      const { answers } = req.body;
      const result = await this.interviewService.saveProgress(id, answers);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof InvalidStateTransitionException) {
        res.status(400).json({ success: false, message: error.message, errorType: 'InvalidState' });
        return;
      }
      res.status(500).json({ success: false, message: error.message });
    }
  };
}
