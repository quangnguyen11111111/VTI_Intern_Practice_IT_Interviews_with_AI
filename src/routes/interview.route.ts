import { Router } from 'express';
import { authenticate, authorize, requireOwnership } from '../middlewares/auth.middleware';
import { InterviewController } from '../controllers/InterviewController';
import { container } from '../config/di';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import { validate } from '../middlewares/validate.middleware';
import { InterviewSessionModel } from '../models/InterviewSession';
import {
  interviewActionSchema,
  interviewAnswersSchema,
  interviewCreateSchema,
  interviewGetSchema,
  interviewHistoryQuerySchema,
  interviewJdCreateSchema,
} from '../validators/interview.validator';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { InterviewQuotaMiddleware } from '../middlewares/interview-quota.middleware';
import { getEnv } from '../config/env';

const router = Router();

const interviewController = container.resolve(InterviewController);
const env = getEnv();
const rateLimitMiddleware = container.resolve(RateLimitMiddleware);

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

const createInterviewRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'interview:create',
  limit: env.RATE_LIMIT_CREATE_INTERVIEW_MAX,
  windowMs: env.RATE_LIMIT_CREATE_INTERVIEW_WINDOW_MS,
  keyGenerator: (req) => req.user ? req.user._id.toString() : req.ip || 'unknown',
});

const aiRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'interview:ai',
  limit: env.RATE_LIMIT_AI_MAX,
  windowMs: env.RATE_LIMIT_AI_WINDOW_MS,
  keyGenerator: (req) => req.user ? req.user._id.toString() : req.ip || 'unknown',
});

const submitRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'interview:submit',
  limit: env.RATE_LIMIT_SUBMIT_MAX,
  windowMs: env.RATE_LIMIT_SUBMIT_WINDOW_MS,
  keyGenerator: (req) => req.user ? req.user._id.toString() : req.ip || 'unknown',
});

const progressRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'interview:progress',
  limit: env.RATE_LIMIT_PROGRESS_MAX,
  windowMs: env.RATE_LIMIT_PROGRESS_WINDOW_MS,
  keyGenerator: (req) => req.user ? req.user._id.toString() : req.ip || 'unknown',
});

const interviewQuotaMiddleware = container.resolve(InterviewQuotaMiddleware).create();

router.post(
  '/',
  validate(interviewCreateSchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  createInterviewRateLimit,
  interviewController.createSession,
);

router.post(
  '/generate-from-jd',
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  uploadMiddleware.single('jdFile'),
  validate(interviewJdCreateSchema),
  createInterviewRateLimit,
  interviewController.createSessionFromJD,
);

// Must be declared before /:id.
router.get(
  '/history',
  validate(interviewHistoryQuerySchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  interviewController.getHistory,
);

router.get('/:id', validate(interviewGetSchema), authenticate, authorize('CANDIDATE', 'INTERVIEWER'), requireInterviewOwner, interviewController.getSession);
router.get('/:id/stream', validate(interviewGetSchema), authenticate, authorize('CANDIDATE', 'INTERVIEWER'), requireInterviewOwner, interviewController.streamStatus);

router.post(
  '/:id/generate',
  validate(interviewActionSchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  aiRateLimit,
  interviewQuotaMiddleware,
  interviewController.generateQuestions,
);

router.post(
  '/:id/progress',
  validate(interviewAnswersSchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  progressRateLimit,
  interviewController.saveProgress,
);

router.post(
  '/:id/submit',
  validate(interviewAnswersSchema),
  authenticate,
  authorize('CANDIDATE', 'INTERVIEWER'),
  requireInterviewOwner,
  submitRateLimit,
  interviewController.submitAnswers,
);

export default router;
