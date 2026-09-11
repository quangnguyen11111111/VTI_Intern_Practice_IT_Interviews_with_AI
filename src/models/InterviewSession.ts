import mongoose, { Schema, Document } from 'mongoose';
import { InterviewStatus } from '../domain/interview/IInterviewState';
import { InterviewSetupPayload } from '../domain/interview/types';

export interface IInterviewSessionDocument extends Document {
  userId: string;
  status: InterviewStatus;
  version: number;
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
    version: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
    },
    setupData: {
      jobPosition: { type: String },
      level: { type: String },
      techStacks: [{ type: String }],
      jdText: { type: String },
      language: { type: String, enum: ['VI', 'EN'], default: 'VI' },
      secondsPerQuestion: { type: Number, min: 60, max: 600, default: 300 },
      strategy: { type: String, enum: ['STANDARD', 'ADAPTIVE'], default: 'STANDARD' }
    },
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

export const InterviewSessionModel = mongoose.model<IInterviewSessionDocument>('InterviewSession', InterviewSessionSchema);
