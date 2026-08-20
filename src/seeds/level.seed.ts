import Level from '../models/level.model';

const levels = [
  { code: 'FRESHER', name: 'Fresher / Intern', description: 'Thực tập sinh hoặc người mới bắt đầu' },
  { code: 'JUNIOR', name: 'Junior', description: 'Dưới 2 năm kinh nghiệm' },
  { code: 'MIDDLE', name: 'Middle', description: '2 - 4 năm kinh nghiệm' },
  { code: 'SENIOR', name: 'Senior', description: '4 - 7 năm kinh nghiệm' },
  { code: 'LEAD', name: 'Lead', description: 'Trưởng nhóm kỹ thuật' },
  { code: 'MANAGER', name: 'Manager / Director', description: 'Quản lý cấp cao' },
];

export const seedLevels = async () => {
  console.log('🔄 Đang seed dữ liệu Level...');
  for (const level of levels) {
    await Level.findOneAndUpdate(
      { code: level.code },
      level,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log('✅ Đã seed dữ liệu Level');
};
