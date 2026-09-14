import mongoose, { Document, Schema } from 'mongoose';

export type PlanStatus = 'ACTIVE' | 'INACTIVE';

export interface IPlan extends Document {
  code: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  durationDays: number;
  features: string[];
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPlan>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: null,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    durationDays: {
      type: Number,
      required: true,
      min: 1,
    },
    features: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model<IPlan>('Plan', schema);