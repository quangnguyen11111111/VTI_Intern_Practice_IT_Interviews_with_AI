import { z } from 'zod';
import { AppError } from '../../utils/AppError';
import { InterviewSetupPayload } from '../../domain/interview/types';
import Role from '../../models/role.model';
import Level from '../../models/level.model';
import Technology from '../../models/technology.model';
import { Model } from 'mongoose';
const id = z.string().regex(/^[a-f0-9]{24}$/i);
const jobSchema = z.object({ interviewId: id, ownerId: id, requestId: z.string().uuid().optional() }).strict();
export function interviewJobData(value: unknown) {
  const parsed = jobSchema.safeParse(value);
  if (!parsed.success) throw new AppError('Invalid job metadata', 400, 'JOB_INPUT_INVALID');
  return parsed.data;
}
export async function resolveGenerationSetup(setup: InterviewSetupPayload): Promise<InterviewSetupPayload> {
  const lookup = async <T extends { name: string }>(value: string | undefined, model: Model<T>) => {
    if (!value || !/^[a-f0-9]{24}$/i.test(value)) return value;
    const record = await model.findById(value).select({ name: 1 }).lean();
    return record?.name ?? '';
  };
  return { jobPosition: await lookup(setup.jobPosition, Role), level: await lookup(setup.level, Level),
    techStacks: await Promise.all((setup.techStacks ?? []).map(async t => await lookup(t, Technology) ?? '')),
    jdText: setup.jdText };
}
