import mongoose, { Schema, Document } from 'mongoose';

export interface IPasswordResetRateLimit extends Document {
  emailHash: string;
  requestTimestamps: Date[];
  cooldownExpiresAt?: Date | null;
  reservationId?: string | null;
  reservationExpiresAt?: Date | null;
  purgeAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const passwordResetRateLimitSchema = new Schema<IPasswordResetRateLimit>(
  {
    emailHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    requestTimestamps: {
      type: [Date],
      default: [],
    },
    cooldownExpiresAt: {
      type: Date,
      default: null,
    },
    reservationId: {
      type: String,
      default: null,
    },
    reservationExpiresAt: {
      type: Date,
      default: null,
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

passwordResetRateLimitSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

const PasswordResetRateLimit = mongoose.model<IPasswordResetRateLimit>(
  'PasswordResetRateLimit',
  passwordResetRateLimitSchema
);

export default PasswordResetRateLimit;
