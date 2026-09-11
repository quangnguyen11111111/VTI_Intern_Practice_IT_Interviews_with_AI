import { Router } from 'express';
import { InterviewController } from '../controllers/InterviewController';
import { container } from '../config/di';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  interviewActionSchema,
  interviewCreateSchema,
  interviewGetSchema,
  interviewJdCreateSchema,
  interviewProgressSchema,
  interviewSubmitSchema,
} from '../validators/interview.validator';
import { authenticate, authorize, requireOwnership } from '../middlewares/auth.middleware';
import { InterviewSessionModel } from '../models/InterviewSession';

const router = Router();

// Retrieve controller from DI container
const interviewController = container.resolve(InterviewController);

const candidateRoles = authorize('CANDIDATE', 'INTERVIEWER');
const ownInterview = requireOwnership(async (req) => {
  const interview = await InterviewSessionModel.findById(req.params.id).select('_id userId');
  if (!interview) return null;
  return { ownerId: interview.userId, resource: interview };
}, { resourceName: 'Phiên phỏng vấn' });

// Routes
router.post('/', validate(interviewCreateSchema), authenticate, candidateRoles, interviewController.createSession);
router.post(
  '/generate-from-jd',
  authenticate,
  candidateRoles,
  uploadMiddleware.single('jdFile'),
  validate(interviewJdCreateSchema),
  interviewController.createSessionFromJD
);
router.get('/:id', validate(interviewGetSchema), authenticate, candidateRoles, ownInterview, interviewController.getSession);
router.get('/:id/stream', validate(interviewGetSchema), authenticate, candidateRoles, ownInterview, interviewController.streamStatus);
router.post('/:id/generate', validate(interviewActionSchema), authenticate, candidateRoles, ownInterview, interviewController.generateQuestions);
router.post('/:id/progress', validate(interviewProgressSchema), authenticate, candidateRoles, ownInterview, interviewController.saveProgress);
router.post('/:id/submit', validate(interviewSubmitSchema), authenticate, candidateRoles, ownInterview, interviewController.submitAnswers);


export default router;
