import { Request, Response } from 'express';
import { InterviewService } from '../services/InterviewService';
import { InvalidStateTransitionException } from '../domain/interview/exceptions/InvalidStateTransitionException';

export class InterviewController {
  constructor(private interviewService: InterviewService) {}

  /**
   * POST /api/interviews
   */
  createSession = async (req: Request, res: Response): Promise<void> => {
    try {
      const session = await this.interviewService.createInterviewSession(req.body);
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
