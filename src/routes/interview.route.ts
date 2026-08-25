import { Router } from 'express';
import { InterviewController } from '../controllers/InterviewController';
import { container } from '../config/di';

const router = Router();

// Retrieve controller from DI container
const interviewController = container.resolve(InterviewController);

// Routes
router.post('/', interviewController.createSession);
router.get('/:id', interviewController.getSession);
router.post('/:id/generate', interviewController.generateQuestions);
router.post('/:id/submit', interviewController.submitAnswers);

export default router;
