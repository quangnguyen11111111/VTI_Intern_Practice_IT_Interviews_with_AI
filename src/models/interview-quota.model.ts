import mongoose, { Document, Schema } from 'mongoose';

export type InterviewQuotaReservationStatus =
  | 'RESERVED'
  | 'COMMITTED';

export interface IInterviewQuotaReservation {
  key: string;
  status: InterviewQuotaReservationStatus;
  createdAt: Date;
}

export interface IInterviewQuota extends Document {
  userId: string;
  quotaDate: string;
  timezone: string;
  used: number;
  reservations: IInterviewQuotaReservation[];
  createdAt: Date;
  updatedAt: Date;
}

const interviewQuotaReservationSchema =
  new Schema<IInterviewQuotaReservation>(
    {
      key: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        enum: ['RESERVED', 'COMMITTED'],
        required: true,
      },
      createdAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
    },
    {
      _id: false,
    }
  );

const interviewQuotaSchema =
  new Schema<IInterviewQuota>(
    {
      userId: {
        type: String,
        required: true,
        index: true,
      },

      quotaDate: {
        type: String,
        required: true,
      },

      timezone: {
        type: String,
        required: true,
      },

      used: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },

      reservations: {
        type: [interviewQuotaReservationSchema],
        default: [],
      },
    },
    {
      timestamps: true,
    }
  );

interviewQuotaSchema.index(
  {
    userId: 1,
    quotaDate: 1,
  },
  {
    unique: true,
  }
);

export const InterviewQuotaModel =
  mongoose.model<IInterviewQuota>(
    'InterviewQuota',
    interviewQuotaSchema
  );