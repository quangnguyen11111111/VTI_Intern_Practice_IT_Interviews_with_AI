import mongoose, { Schema, Document } from 'mongoose';

export interface IInterviewQuestionDocument extends Document {
  sessionId: mongoose.Types.ObjectId;
  order: number;
  difficulty: string;
  content: {
    en: string;
    vi: string;
  };
  candidateAnswer: string | null;
  feedback: {
    en: string;
    vi: string;
  } | null;
  score: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const InterviewQuestionSchema: Schema = new Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewSession',
      required: true
    },
    ownerId: { type: String }, // New writes set this; legacy children remain scoped through their parent.
    order: {
      type: Number,
      required: true
    },
    difficulty: {
      type: String,
      required: true
    },
    content: {
      en: { type: String, required: true },
      vi: { type: String, required: true }
    },
    candidateAnswer: {
      type: String,
      default: null
    },
    feedback: {
      en: { type: String },
      vi: { type: String }
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

InterviewQuestionSchema.index({ sessionId: 1, order: 1 }, { unique: true });
export const InterviewQuestionModel = mongoose.model<IInterviewQuestionDocument>('InterviewQuestion', InterviewQuestionSchema);
