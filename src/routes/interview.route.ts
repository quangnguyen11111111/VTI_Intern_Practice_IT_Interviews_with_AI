import { Router } from 'express';
import { InterviewController } from '../controllers/InterviewController';
import { container } from '../config/di';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate.middleware';
import { authenticate, authorize, requireOwnership } from '../middlewares/auth.middleware';
import { InterviewSessionModel } from '../models/InterviewSession';
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

const requireInterviewOwner = requireOwnership(async (req) => {
  const session = await InterviewSessionModel.findById(req.params.id)
    .select('_id userId')
    .lean();

  if (!session) return null;

  return {
    ownerId: session.userId,
    resource: session,
  };
}, {
  resourceName: 'Phiên phỏng vấn',
  notFoundMessage: 'Phiên phỏng vấn không tồn tại',
  notFoundCode: 'INTERVIEW_NOT_FOUND',
  attachKey: 'interviewSession',
});

// Routes
router.post(
  '/',
  validate(interviewCreateSchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  interviewController.createSession
);
router.post(
  '/generate-from-jd',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  uploadMiddleware.single('jdFile'),
  validate(interviewJdCreateSchema),
  interviewController.createSessionFromJD
);
router.get('/:id', validate(interviewGetSchema), authenticate, authorize('CANDIDATE', 'INTERVIEWER'), requireInterviewOwner, interviewController.getSession);
router.get('/:id/stream', validate(interviewGetSchema), authenticate, authorize('CANDIDATE', 'INTERVIEWER'), requireInterviewOwner, interviewController.streamStatus);
router.post('/:id/generate', validate(interviewActionSchema), authenticate, authorize('CANDIDATE', 'INTERVIEWER'), requireInterviewOwner, interviewController.generateQuestions);
router.post('/:id/progress', validate(interviewAnswersSchema), authenticate, authorize('CANDIDATE', 'INTERVIEWER'), requireInterviewOwner, interviewController.saveProgress);
router.post('/:id/submit', validate(interviewAnswersSchema), authenticate, authorize('CANDIDATE', 'INTERVIEWER'), requireInterviewOwner, interviewController.submitAnswers);


export default router;
