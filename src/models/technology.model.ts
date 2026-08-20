import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITechnology extends Document {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  roles: Types.ObjectId[];
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const technologySchema = new Schema<ITechnology>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    icon: {
      type: String,
      trim: true,
    },
    roles: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Role',
      },
    ],
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

// code is implicitly indexed by unique: true
technologySchema.index({ status: 1 });
technologySchema.index({ roles: 1 }); // Index to optimize queries filtering technologies by role

const Technology = mongoose.model<ITechnology>('Technology', technologySchema);

export default Technology;
