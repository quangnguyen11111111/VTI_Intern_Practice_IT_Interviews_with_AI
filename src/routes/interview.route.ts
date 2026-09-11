import { Router } from 'express';
import { InterviewController } from '../controllers/InterviewController';
import { container } from '../config/di';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  interviewActionSchema,
  interviewAnswersSchema,
  interviewCreateSchema,
  interviewGetSchema,
  interviewJdCreateSchema,
} from '../validators/interview.validator';

const router = Router();

// Retrieve controller from DI container
const interviewController = container.resolve(InterviewController);

// Routes
router.post('/', validate(interviewCreateSchema), interviewController.createSession);
router.post(
  '/generate-from-jd',
  uploadMiddleware.single('jdFile'),
  validate(interviewJdCreateSchema),
  interviewController.createSessionFromJD
);
router.get('/:id', validate(interviewGetSchema), interviewController.getSession);
router.get('/:id/stream', validate(interviewGetSchema), interviewController.streamStatus);
router.post('/:id/generate', validate(interviewActionSchema), interviewController.generateQuestions);
router.post('/:id/progress', validate(interviewAnswersSchema), interviewController.saveProgress);
router.post('/:id/submit', validate(interviewAnswersSchema), interviewController.submitAnswers);


export default router;
