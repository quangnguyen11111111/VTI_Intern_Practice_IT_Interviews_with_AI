import mongoose, { Schema, Document } from 'mongoose';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload } from '../domain/interview/types';

export interface IInterviewSessionDocument extends Document {
  userId: string;
  status: InterviewStatus;
  setupData: InterviewSetupPayload;
  overallScore: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewSessionSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: false, // Optional for now
    },
    status: {
      type: String,
      enum: ['PENDING', 'GENERATING', 'IN_PROGRESS', 'EVALUATING', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
      required: true
    },
    setupData: {
      jobPosition: { type: String, required: true },
      level: { type: String, required: true },
      techStacks: [{ type: String }]
    },
    overallScore: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const InterviewSessionModel = mongoose.model<IInterviewSessionDocument>('InterviewSession', InterviewSessionSchema);
