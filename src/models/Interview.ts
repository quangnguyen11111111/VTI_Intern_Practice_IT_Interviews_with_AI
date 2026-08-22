import mongoose, { Schema, Document } from 'mongoose';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload } from '../domain/interview/types';

export interface IInterviewDocument extends Document {
  status: InterviewStatus;
  setupData: InterviewSetupPayload;
  questions: mongoose.Schema.Types.Mixed[];
  answers: mongoose.Schema.Types.Mixed[];
  score: number;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewSchema: Schema = new Schema(
  {
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
    questions: {
      type: [Schema.Types.Mixed],
      default: []
    },
    answers: {
      type: [Schema.Types.Mixed],
      default: []
    },
    score: {
      type: Number,
      default: null
    }
  },
  {
    timestamps: true
  }
);

export const InterviewModel = mongoose.model<IInterviewDocument>('Interview', InterviewSchema);
