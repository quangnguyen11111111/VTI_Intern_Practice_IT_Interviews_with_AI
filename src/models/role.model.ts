import mongoose, { Schema, Document } from 'mongoose';

export interface IRole extends Document {
  code: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
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
roleSchema.index({ status: 1 });

const Role = mongoose.model<IRole>('Role', roleSchema);

export default Role;
