import mongoose, { Schema, Document } from 'mongoose';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload } from '../domain/interview/types';

export interface IInterviewSessionDocument extends Document {
  userId: string;
  status: InterviewStatus;
  setupData: InterviewSetupPayload;
  overallScore: number | null;
  dimensions: { name: string; score: number; reasoning: string }[] | null;
  learningPath: { 
    topic: { en: string; vi: string }; 
    priority: string; 
    suggestion: { en: string; vi: string } 
  }[] | null;
  metadata?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
  createdAt: Date;
  updatedAt: Date;
  terminalAt?: Date;
  contentPurgeAt?: Date;
  contentPurgedAt?: Date;
  recordPurgeAt?: Date;
}

const InterviewSessionSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: false, // Legacy records remain readable; every repository create requires an authenticated owner.
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
      jdText: { type: String, maxlength: 10000 }
    },
    terminalAt: Date,
    contentPurgeAt: Date,
    contentPurgedAt: Date,
    recordPurgeAt: Date,
    overallScore: {
      type: Number,
      default: null
    },
    dimensions: [{
      name: { type: String },
      score: { type: Number },
      reasoning: { type: String }
    }],
    learningPath: [{
      topic: { 
        en: { type: String },
        vi: { type: String }
      },
      priority: { type: String, enum: ['High', 'Medium', 'Low'] },
      suggestion: { 
        en: { type: String },
        vi: { type: String }
      }
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

InterviewSessionSchema.index({ status: 1, contentPurgeAt: 1, _id: 1 });
InterviewSessionSchema.index({ status: 1, recordPurgeAt: 1, _id: 1 });
InterviewSessionSchema.index({ userId: 1, createdAt: -1 });
export const InterviewSessionModel = mongoose.model<IInterviewSessionDocument>('InterviewSession', InterviewSessionSchema);
