import { InterviewStatus } from '../domain/interview/IInterviewState';
export const DAY_MS = 24 * 60 * 60 * 1000;
export const TERMINAL_STATUSES = ['COMPLETED', 'FAILED'] as const;
export function terminalUpdate(status: InterviewStatus, now = new Date()) {
  if (status !== 'COMPLETED' && status !== 'FAILED') return [{ $set: { status } }];
  return [
    { $set: { status, terminalAt: { $ifNull: ['$terminalAt', now] } } },
    { $set: { contentPurgeAt: { $add: ['$terminalAt', 30 * DAY_MS] }, recordPurgeAt: { $add: ['$terminalAt', 365 * DAY_MS] } } },
  ];
}
