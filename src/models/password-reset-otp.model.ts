import mongoose, { Schema, Document, Types } from 'mongoose';

export type OtpDeliveryState = 'PENDING' | 'SENT' | 'FAILED';

export interface IPasswordResetOtp extends Document {
  emailHash: string;
  otpHash: string;
  userId?: Types.ObjectId | null;
  isSynthetic: boolean;
  attempts: number;
  deliveryState: OtpDeliveryState;
  usedAt?: Date | null;
  expiresAt: Date;
  purgeAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetOtpSchema = new Schema<IPasswordResetOtp>(
  {
    emailHash: {
      type: String,
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    isSynthetic: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    deliveryState: {
      type: String,
      enum: ['PENDING', 'SENT', 'FAILED'],
      default: 'PENDING',
    },
    usedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    purgeAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

passwordResetOtpSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
passwordResetOtpSchema.index({ emailHash: 1, createdAt: -1 });
passwordResetOtpSchema.index({ emailHash: 1, usedAt: 1, expiresAt: 1 });

const PasswordResetOtp = mongoose.model<IPasswordResetOtp>(
  'PasswordResetOtp',
  passwordResetOtpSchema
);

export default PasswordResetOtp;
