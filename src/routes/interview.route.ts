import { Router } from 'express';
import { InterviewController } from '../controllers/InterviewController';
import { container } from '../config/di';
import { uploadMiddleware } from '../middlewares/upload.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  interviewActionSchema,
  interviewAnswersSchema,
  interviewCreateSchema,
  interviewGetSchema,
  interviewJdCreateSchema,
  interviewHistoryQuerySchema,
} from '../validators/interview.validator';
import { RateLimitMiddleware } from '../middlewares/rate-limit.middleware';
import { InterviewQuotaMiddleware } from '../middlewares/interview-quota.middleware';
import { getEnv } from '../config/env';

const router = Router();

// Retrieve controller from DI container
const interviewController = container.resolve(InterviewController);

const env = getEnv();

const rateLimitMiddleware = container.resolve(RateLimitMiddleware);

const createInterviewRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'interview:create',
  limit: env.RATE_LIMIT_CREATE_INTERVIEW_MAX,
  windowMs: env.RATE_LIMIT_CREATE_INTERVIEW_WINDOW_MS,
});

const aiRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'interview:ai',
  limit: env.RATE_LIMIT_AI_MAX,
  windowMs: env.RATE_LIMIT_AI_WINDOW_MS,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip || 'unknown';
  },
});

const submitRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'interview:submit',
  limit: env.RATE_LIMIT_SUBMIT_MAX,
  windowMs: env.RATE_LIMIT_SUBMIT_WINDOW_MS,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip || 'unknown';
  },
});

const progressRateLimit = rateLimitMiddleware.create({
  keyPrefix: 'interview:progress',
  limit: env.RATE_LIMIT_PROGRESS_MAX,
  windowMs: env.RATE_LIMIT_PROGRESS_WINDOW_MS,
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip || 'unknown';
  },
});

const interviewQuotaMiddleware = container.resolve(InterviewQuotaMiddleware).create();

// Routes
router.post(
  '/',
  validate(interviewCreateSchema),
  createInterviewRateLimit,
  interviewController.createSession
);

router.post(
  '/generate-from-jd',
  uploadMiddleware.single('jdFile'),
  validate(interviewJdCreateSchema),
  createInterviewRateLimit,
  interviewController.createSessionFromJD
);

// HIS-01: Interview history
// Must be declared before /:id
router.get(
  '/history',
  authenticate,
  validate(interviewHistoryQuerySchema),
  interviewController.getHistory
);

router.get('/:id', validate(interviewGetSchema), interviewController.getSession);
router.get('/:id/stream', validate(interviewGetSchema), interviewController.streamStatus);

router.post(
  '/:id/generate',
  authenticate,
  validate(interviewActionSchema),
  aiRateLimit,
  interviewQuotaMiddleware,
  interviewController.generateQuestions
);

router.post(
  '/:id/progress',
  validate(interviewAnswersSchema),
  progressRateLimit,
  interviewController.saveProgress
);

router.post(
  '/:id/submit',
  validate(interviewAnswersSchema),
  submitRateLimit,
  interviewController.submitAnswers
);

export default router;
