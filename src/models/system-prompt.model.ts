import mongoose, {
  Document,
  Schema
} from 'mongoose';

export type SystemPromptType =
  | 'GENERATION'
  | 'EVALUATION'
  | 'LEARNING_PATH';

export type SystemPromptLanguage =
  | 'EN'
  | 'VI';

export type SystemPromptStatus =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'ARCHIVED';

export interface ISystemPrompt
  extends Document {
  promptKey: string;
  type: SystemPromptType;
  language: SystemPromptLanguage;
  version: number;
  content: string;
  status: SystemPromptStatus;
  createdBy: mongoose.Types.ObjectId;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const systemPromptSchema =
  new Schema<ISystemPrompt>(
    {
      promptKey: {
        type: String,
        required: true,
        trim: true
      },

      type: {
        type: String,
        enum: [
          'GENERATION',
          'EVALUATION',
          'LEARNING_PATH'
        ],
        required: true
      },

      language: {
        type: String,
        enum: ['EN', 'VI'],
        required: true
      },

      version: {
        type: Number,
        required: true,
        min: 1
      },

      content: {
        type: String,
        required: true,
        trim: true,
        minlength: 1
      },

      status: {
        type: String,
        enum: [
          'DRAFT',
          'PUBLISHED',
          'ARCHIVED'
        ],
        default: 'DRAFT',
        required: true
      },

      createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      publishedAt: {
        type: Date,
        default: null
      }
    },
    {
      timestamps: true
    }
  );

systemPromptSchema.index(
  {
    promptKey: 1,
    type: 1,
    language: 1,
    version: 1
  },
  {
    unique: true
  }
);

systemPromptSchema.index({
  promptKey: 1,
  type: 1,
  language: 1,
  status: 1
});

systemPromptSchema.index(
  {
    promptKey: 1,
    type: 1,
    language: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      status: 'PUBLISHED'
    }
  }
);

export const SystemPromptModel =
  mongoose.model<ISystemPrompt>(
    'SystemPrompt',
    systemPromptSchema
  );