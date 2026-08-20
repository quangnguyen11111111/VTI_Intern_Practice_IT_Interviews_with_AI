import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import User from '../models/user.model';

export const seedUsers = async () => {
  try {
    console.log('⏳ Đang xóa dữ liệu User cũ...');
    await User.deleteMany({});

    console.log('🌱 Đang tạo dữ liệu User mới...');
    const usersToInsert = [];
    
    // Mật khẩu mặc định cho tất cả user (ví dụ: 'password123')
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Tạo 1 Admin
    usersToInsert.push({
      email: 'admin@vti.com.vn',
      passwordHash,
      fullName: 'Admin System',
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    // 2. Tạo vài Interviewers bằng Faker
    for (let i = 0; i < 3; i++) {
      usersToInsert.push({
        email: faker.internet.email().toLowerCase(),
        passwordHash,
        fullName: faker.person.fullName(),
        role: 'INTERVIEWER',
        status: 'ACTIVE',
      });
    }

    // 3. Tạo vài Candidates
    for (let i = 0; i < 10; i++) {
      usersToInsert.push({
        email: faker.internet.email().toLowerCase(),
        passwordHash,
        fullName: faker.person.fullName(),
        role: 'CANDIDATE',
        status: 'ACTIVE',
      });
    }

    await User.insertMany(usersToInsert);
    console.log(`✅ Seed thành công ${usersToInsert.length} Users!`);
  } catch (error) {
    console.error('❌ Lỗi khi seed Users:', error);
    throw error; // Ném lỗi ra ngoài để file index.ts bắt được
  }
};
