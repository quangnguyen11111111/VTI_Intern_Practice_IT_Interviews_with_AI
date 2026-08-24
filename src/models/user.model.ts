import mongoose, { Schema, Document } from 'mongoose';

export type UserLevel = 'FRESHER' | 'JUNIOR' | 'MIDDLE' | 'SENIOR' | 'LEAD' | 'MANAGER';

// 1. Interface (Khai báo kiểu dữ liệu chuẩn)
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  authVersion: number;
  credentialVersion: number;
  avatarUrl?: string | null;
  currentLevel?: UserLevel | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  bio?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// 2. Schema (Cấu trúc bảng trong MongoDB)
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    role: {
      type: String,
      enum: ['CANDIDATE', 'INTERVIEWER', 'ADMIN'],
      default: 'CANDIDATE',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'LOCKED'],
      default: 'ACTIVE',
    },
    authVersion: {
      type: Number,
      default: 0,
    },
    credentialVersion: {
      type: Number,
      default: 0,
      min: 0,
    },
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: null,
    },
    currentLevel: {
      type: String,
      enum: ['FRESHER', 'JUNIOR', 'MIDDLE', 'SENIOR', 'LEAD', 'MANAGER'],
      default: null,
    },
    githubUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: null,
    },
    linkedinUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.authVersion;
        delete ret.credentialVersion;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.authVersion;
        delete ret.credentialVersion;
        return ret;
      },
    },
  }
);

// 3. Indexes (Tối ưu truy vấn)
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

// 4. Khởi tạo Model
const User = mongoose.model<IUser>('User', userSchema);

export default User;
