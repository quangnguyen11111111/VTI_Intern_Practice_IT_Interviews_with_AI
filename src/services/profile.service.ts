import User, { IUser } from '../models/user.model';
import { SafeUser } from '../types/auth.type';
import { AppError } from '../utils/AppError';
import { UpdateProfileInput } from '../validators/profile.validator';

const toSafeProfile = (user: IUser): SafeUser => ({
  id: user._id.toString(),
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  status: user.status,
  avatarUrl: user.avatarUrl ?? null,
  currentLevel: user.currentLevel ?? null,
  githubUrl: user.githubUrl ?? null,
  linkedinUrl: user.linkedinUrl ?? null,
  bio: user.bio ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getCurrentProfile = async (userId: string): Promise<SafeUser> => {
  const user = await User.findOne({ _id: userId, status: 'ACTIVE' });
  if (!user) {
    throw new AppError('Người dùng không tồn tại hoặc không hoạt động', 401, 'AUTH_UNAUTHORIZED');
  }
  return toSafeProfile(user);
};

export const updateCurrentProfile = async (
  userId: string,
  input: UpdateProfileInput
): Promise<SafeUser> => {
  const updatedUser = await User.findOneAndUpdate(
    { _id: userId, status: 'ACTIVE' },
    { $set: input },
    { returnDocument: 'after', runValidators: true }
  );

  if (!updatedUser) {
    throw new AppError('Người dùng không tồn tại hoặc không hoạt động', 401, 'AUTH_UNAUTHORIZED');
  }
  return toSafeProfile(updatedUser);
};
