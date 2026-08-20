import Role from '../models/role.model';

const roles = [
  { code: 'FRONTEND_DEVELOPER', name: 'Frontend Developer', description: 'Phát triển giao diện người dùng' },
  { code: 'BACKEND_DEVELOPER', name: 'Backend Developer', description: 'Phát triển logic và API máy chủ' },
  { code: 'FULLSTACK_DEVELOPER', name: 'Fullstack Developer', description: 'Phát triển cả frontend và backend' },
  { code: 'DEVOPS_ENGINEER', name: 'DevOps Engineer', description: 'Vận hành, CI/CD và quản trị hạ tầng' },
  { code: 'QA_ENGINEER', name: 'QA Engineer (Tester)', description: 'Đảm bảo chất lượng phần mềm' },
  { code: 'DATA_SCIENTIST', name: 'Data Scientist', description: 'Phân tích dữ liệu và học máy' },
  { code: 'DATA_ENGINEER', name: 'Data Engineer', description: 'Xây dựng đường ống dữ liệu' },
  { code: 'MOBILE_DEVELOPER', name: 'Mobile Developer', description: 'Phát triển ứng dụng di động (iOS/Android)' },
  { code: 'CLOUD_ARCHITECT', name: 'Cloud Architect', description: 'Thiết kế kiến trúc đám mây' },
  { code: 'SECURITY_ENGINEER', name: 'Security Engineer', description: 'Kỹ sư bảo mật' },
  { code: 'UI_UX_DESIGNER', name: 'UI/UX Designer', description: 'Thiết kế giao diện và trải nghiệm người dùng' },
  { code: 'PRODUCT_MANAGER', name: 'Product Manager', description: 'Quản lý sản phẩm' },
  { code: 'BUSINESS_ANALYST', name: 'Business Analyst', description: 'Phân tích nghiệp vụ' },
  { code: 'SCRUM_MASTER', name: 'Scrum Master', description: 'Điều phối quy trình Scrum' },
];

export const seedRoles = async () => {
  console.log('🔄 Đang seed dữ liệu Role...');
  for (const role of roles) {
    await Role.findOneAndUpdate(
      { code: role.code },
      role,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  console.log('✅ Đã seed dữ liệu Role');
};
