import mongoose, { Schema, Document } from 'mongoose';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload } from '../domain/interview/types';

export interface IInterviewSessionDocument extends Document {
  userId: string;
  status: InterviewStatus;
  setupData: InterviewSetupPayload;
  overallScore: number | null;
  learningPath: { topic: string; priority: string; suggestion: string }[] | null;
  metadata?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
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
      jobPosition: { type: String },
      level: { type: String },
      techStacks: [{ type: String }],
      jdText: { type: String }
    },
    overallScore: {
      type: Number,
      default: null
    },
    learningPath: [{
      topic: { type: String },
      priority: { type: String, enum: ['High', 'Medium', 'Low'] },
      suggestion: { type: String }
    }],
    metadata: {
      promptTokens: { type: Number, default: 0 },
      candidatesTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
    }
  },
  {
    timestamps: true
  }
);

export const InterviewSessionModel = mongoose.model<IInterviewSessionDocument>('InterviewSession', InterviewSessionSchema);
