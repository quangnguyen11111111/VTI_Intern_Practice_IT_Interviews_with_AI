import { injectable, inject } from 'tsyringe';
import { Request, Response } from 'express';
import { InterviewService } from '../services/InterviewService';
import { InvalidStateTransitionException } from '../domain/interview/exceptions/InvalidStateTransitionException';

@injectable()
export class InterviewController {
  constructor(@inject(InterviewService) private interviewService: InterviewService) {}

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
}
