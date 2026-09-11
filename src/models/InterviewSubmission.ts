import mongoose, { Document, Schema } from 'mongoose';

export type SubmissionAnswerState = 'ANSWERED' | 'SKIPPED';
export type SubmissionStatus = 'ACCEPTED' | 'EVALUATING' | 'COMPLETED' | 'FAILED';

export interface SubmissionAnswer {
  questionId: mongoose.Types.ObjectId;
  state: SubmissionAnswerState;
  candidateAnswer?: string;
}

export interface IInterviewSubmissionDocument extends Document {
  sessionId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  submissionVersion: number;
  operationId: mongoose.Types.ObjectId;
  answers: SubmissionAnswer[];
  answerFingerprint: string;
  status: SubmissionStatus;
  resultRef?: mongoose.Types.ObjectId | null;
  safeErrorCode?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionAnswerSchema = new Schema<SubmissionAnswer>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'InterviewQuestion', required: true },
    state: { type: String, enum: ['ANSWERED', 'SKIPPED'], required: true },
    candidateAnswer: { type: String, maxlength: 5000 }
  },
  { _id: false }
);

const InterviewSubmissionSchema = new Schema<IInterviewSubmissionDocument>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submissionVersion: { type: Number, required: true, min: 1 },
    operationId: { type: Schema.Types.ObjectId, ref: 'OperationRecord', required: true },
    answers: { type: [SubmissionAnswerSchema], required: true },
    answerFingerprint: { type: String, required: true, minlength: 64, maxlength: 64 },
    status: {
      type: String,
      enum: ['ACCEPTED', 'EVALUATING', 'COMPLETED', 'FAILED'],
      default: 'ACCEPTED',
      required: true
    },
    resultRef: { type: Schema.Types.ObjectId, ref: 'InterviewEvaluationResult', default: null },
    safeErrorCode: { type: String, default: null }
  },
  { timestamps: true }
);

InterviewSubmissionSchema.index({ sessionId: 1, submissionVersion: 1 }, { unique: true });
InterviewSubmissionSchema.index({ operationId: 1 }, { unique: true });

export const InterviewSubmissionModel = mongoose.model<IInterviewSubmissionDocument>(
  'InterviewSubmission',
  InterviewSubmissionSchema
);
