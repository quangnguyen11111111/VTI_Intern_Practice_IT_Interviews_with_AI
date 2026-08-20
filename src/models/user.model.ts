import mongoose, { Schema, Document } from 'mongoose';

// 1. Interface (Khai báo kiểu dữ liệu chuẩn)
export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName: string;
  role: 'CANDIDATE' | 'INTERVIEWER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE';
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
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['CANDIDATE', 'INTERVIEWER', 'ADMIN'],
      default: 'CANDIDATE',
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true, // Tự động tạo createdAt, updatedAt
  }
);

// 3. Indexes (Tối ưu truy vấn)
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });

// 4. Khởi tạo Model
const User = mongoose.model<IUser>('User', userSchema);

export default User;
