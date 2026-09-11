import mongoose from 'mongoose';
import { getEnv } from '../config/env';
import { InterviewSessionModel } from '../models/InterviewSession';
import { InterviewQuestionModel } from '../models/InterviewQuestion';
import { RetentionRun } from '../models/retention-run.model';
import { AppError } from '../utils/AppError';
import { TERMINAL_STATUSES } from './retention-policy';

export async function runRetentionBatch(options: { dryRun?: boolean; limit?: number; now?: Date } = {}) {
  const { dryRun = true, limit = 100, now = new Date() } = options;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isFinite(now.getTime())) {
    throw new AppError('Invalid retention batch', 400, 'RETENTION_INPUT_INVALID');
  }
  const env = getEnv();
  if (!dryRun && (!env.RETENTION_MUTATION_ENABLED || !env.RETENTION_APPROVAL_ID)) {
    throw new AppError('Retention mutation disabled', 503, 'RETENTION_DISABLED');
  }
  const due = { status: { $in: [...TERMINAL_STATUSES] }, userId: { $regex: /^[a-f0-9]{24}$/i }, terminalAt: { $type: 'date' as const } };
  // Projection prevents the maintenance job from reading the content it purges.
  const candidates = await InterviewSessionModel.find({ ...due, $or: [
    { contentPurgeAt: { $lte: now }, contentPurgedAt: { $exists: false } }, { recordPurgeAt: { $lte: now } },
  ] }).select({ _id: 1, userId: 1, status: 1, terminalAt: 1, contentPurgeAt: 1, contentPurgedAt: 1, recordPurgeAt: 1 })
    .sort({ _id: 1 }).limit(limit).lean();
  const summary = { dryRun, policy: env.RETENTION_APPROVAL_ID || 'ENGINEERING-DEFAULT-DRY-RUN',
    contentEligible: candidates.filter(s => !s.contentPurgedAt && s.contentPurgeAt && s.contentPurgeAt <= now).length,
    recordEligible: candidates.filter(s => s.recordPurgeAt && s.recordPurgeAt <= now).length,
    contentPurged: 0, recordsPurged: 0 };
  if (dryRun) { await RetentionRun.create(summary); return summary; }
  const transaction = await mongoose.startSession();
  try {
    await transaction.withTransaction(async () => {
      summary.contentPurged = 0; summary.recordsPurged = 0;
      for (const candidate of candidates) {
        const exact = { _id: candidate._id, userId: candidate.userId, status: candidate.status, terminalAt: candidate.terminalAt };
        if (candidate.recordPurgeAt && candidate.recordPurgeAt <= now) {
          const removed = await InterviewSessionModel.deleteOne({ ...exact, recordPurgeAt: { $lte: now } }, { session: transaction });
          if (removed.deletedCount === 1) {
            await InterviewQuestionModel.deleteMany({ sessionId: candidate._id }, { session: transaction });
            summary.recordsPurged++;
          }
        } else {
          const result = await InterviewSessionModel.collection.updateOne({ ...exact,
            contentPurgeAt: { $lte: now }, contentPurgedAt: { $exists: false } }, {
            $unset: { 'setupData.jdText': '', 'setupData.cvText': '', providerPayload: '', providerResponse: '' },
            $set: { contentPurgedAt: now },
          }, { session: transaction });
          summary.contentPurged += result.modifiedCount;
        }
      }
      // Audit failure rolls back every mutation in this bounded batch.
      await RetentionRun.create([summary], { session: transaction });
    });
  } catch { throw new AppError('Retention batch failed', 503, 'RETENTION_BATCH_FAILED'); }
  finally { await transaction.endSession(); }
  return summary;
}
