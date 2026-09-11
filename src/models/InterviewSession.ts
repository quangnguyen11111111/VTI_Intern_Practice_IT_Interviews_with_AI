import mongoose, {
  Schema,
  Document
} from 'mongoose';

import {
  InterviewStatus
} from '../domain/interview/IInterviewState';

import {
  InterviewSetupPayload
} from '../domain/interview/types';

export interface InterviewPromptVersion {
  promptId: string;
  version: number;
  language: 'EN' | 'VI';
}

export interface IInterviewSessionDocument
  extends Document {
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

  promptVersions?: {
    generation?: InterviewPromptVersion;
    evaluation?: InterviewPromptVersion;
    learningPath?: InterviewPromptVersion;
  };
  metadata?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };

  createdAt: Date;
  updatedAt: Date;
}

const InterviewSessionSchema = new Schema<IInterviewSessionDocument>(
  {
    userId: { type: String, required: false },
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
    overallScore: { type: Number, default: null },
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
    promptVersions: {
      generation: {
        promptId: { type: String },
        version: { type: Number, min: 1 },
        language: { type: String, enum: ['EN', 'VI'] }
      },
      evaluation: {
        promptId: { type: String },
        version: { type: Number, min: 1 },
        language: { type: String, enum: ['EN', 'VI'] }
      },
      learningPath: {
        promptId: { type: String },
        version: { type: Number, min: 1 },
        language: { type: String, enum: ['EN', 'VI'] }
      }
    },
    metadata: {
      promptTokens: { type: Number, default: 0 },
      candidatesTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true
  }
);

InterviewSessionSchema.index({
  userId: 1,
  createdAt: -1,
  _id: -1
});

export const InterviewSessionModel =
  mongoose.model<IInterviewSessionDocument>(
    'InterviewSession',
    InterviewSessionSchema
  );