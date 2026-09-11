import mongoose, {
  Document,
  Schema
} from 'mongoose';

export interface IApiRateLimit
  extends Document {
  key: string;
  count: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const apiRateLimitSchema =
  new Schema<IApiRateLimit>(
    {
      key: {
        type: String,
        required: true,
        unique: true,
        index: true
      },

      count: {
        type: Number,
        required: true,
        default: 0,
        min: 0
      },

      expiresAt: {
        type: Date,
        required: true
      }
    },
    {
      timestamps: true
    }
  );

apiRateLimitSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);

export const ApiRateLimitModel =
  mongoose.model<IApiRateLimit>(
    'ApiRateLimit',
    apiRateLimitSchema
  );