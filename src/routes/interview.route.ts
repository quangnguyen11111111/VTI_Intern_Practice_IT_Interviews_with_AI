import { Router } from 'express';
import { InterviewController } from '../controllers/InterviewController';
import { InterviewService } from '../services/InterviewService';
import { MongoInterviewRepository } from '../repositories/MongoInterviewRepository';

const router = Router();

// Khởi tạo dependencies thủ công (Basic Dependency Injection)
const interviewRepository = new MongoInterviewRepository();
const interviewService = new InterviewService(interviewRepository);
const interviewController = new InterviewController(interviewService);

// Routes
router.post('/', interviewController.createSession);
router.get('/:id', interviewController.getSession);
router.post('/:id/generate', interviewController.generateQuestions);
router.post('/:id/submit', interviewController.submitAnswers);

export default router;
