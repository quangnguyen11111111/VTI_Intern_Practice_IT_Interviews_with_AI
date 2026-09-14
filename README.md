# VTI Intern Practice: IT Interviews with AI

Đây là hệ thống phỏng vấn giả lập bằng AI dành cho các ứng viên IT, giúp thực hành và đánh giá kỹ năng chuyên môn trước các kỳ phỏng vấn thực tế.

---

## 🚀 Setup & Bàn giao hệ thống (System Handover)

Tài liệu này cung cấp hướng dẫn đầy đủ để một Kỹ sư phần mềm mới có thể clone, cài đặt, chạy thử và tham gia phát triển dự án mà không cần hỗ trợ trực tiếp.

### 1. Yêu cầu hệ thống (Prerequisites)
Đảm bảo máy tính của bạn đã cài đặt các phần mềm sau:
- **Node.js**: Phiên bản >= 18.x (khuyến nghị dùng [nvm](https://github.com/nvm-sh/nvm) để quản lý).
- **MongoDB**: Phiên bản >= 6.0 (có thể chạy Local qua Docker, hoặc dùng MongoDB Atlas). **Lưu ý**: MongoDB bắt buộc phải chạy với chế độ Replica Set để hỗ trợ Multi-Document Transactions.
- **Git**: Quản lý source code.
- **Docker & Docker Compose** (Tùy chọn, dùng để start nhanh MongoDB và ứng dụng).

### 2. Cài đặt Dependencies (NPM Install)
Dự án được cấu trúc thành hai phần: `backend` (thư mục gốc) và `client` (thư mục frontend).

Mở terminal, clone dự án và chạy lệnh sau để cài đặt dependencies cho cả Backend và Client:
```bash
# Cài đặt thư viện cho Backend
npm install

# Cài đặt thư viện cho Client (Frontend)
npm install --prefix client
```

### 3. Cấu hình biến môi trường (Environment Variables)
Backend sử dụng file `.env` để quản lý các cấu hình nhạy cảm.

1. Sao chép file mẫu:
```bash
cp .env.example .env
```
2. Mở file `.env` và cấu hình các giá trị phù hợp. Chú ý các biến quan trọng:
- `MONGODB_URI`: Chuỗi kết nối MongoDB (ví dụ: `mongodb://localhost:27017/vti-ai-interview?replicaSet=rs0`).
- `JWT_SECRET`: Chuỗi bí mật dùng để mã hóa token đăng nhập.
- `GEMINI_API_KEY`: API Key lấy từ Google AI Studio nếu bạn muốn dùng Gemini (hoặc dùng MockAiProvider để test không cần key).

### 4. Khởi tạo cơ sở dữ liệu (Database Seeding)
Sau khi kết nối MongoDB thành công, bạn cần tạo dữ liệu mẫu (System Prompts, Users admin/candidate) để hệ thống hoạt động:
```bash
npm run db:seed
```
*Lệnh này sẽ chạy script `src/seeds/index.ts` để nạp dữ liệu.*

### 5. Hướng dẫn chạy dự án (NPM Scripts)

**Chạy môi trường phát triển (Development):**
```bash
# Chạy Backend (Cổng mặc định: 3000)
npm run dev

# Chạy Frontend Client (Mở terminal mới)
npm run dev --prefix client
```

**Các lệnh kiểm thử và kiểm tra chất lượng code (Lint/Test):**
```bash
# Kiểm tra lỗi cú pháp (Lint)
npm run lint           # Backend
npm run lint --prefix client  # Client

# Chạy Unit Tests
npm run test           # Backend
npm run test --prefix client  # Client
```

**Build cho môi trường Production:**
```bash
# Build Backend
npm run build

# Build Client
npm run build --prefix client
```

### 6. Khởi động nhanh bằng Docker (Docker / Compose)
Nếu bạn không muốn cài đặt MongoDB trực tiếp vào máy tính, dự án cung cấp sẵn `docker-compose.yml`.

```bash
# Khởi chạy MongoDB Replica Set (và các service nếu được định nghĩa) dưới background
docker-compose up -d

# Tắt các service
docker-compose down
```

---

## 🛠️ Công nghệ sử dụng
- **Backend:** Node.js, Express.js, TypeScript.
- **Frontend:** React, Vite, TailwindCSS.
- **Database:** MongoDB (sử dụng Mongoose) - Multi-Document Transactions trên Replica Set.
- **Mẫu Thiết Kế (Design Patterns):** State Pattern, Layered Architecture, Dependency Injection.

## 📐 Kiến trúc và Tài liệu nâng cao

Bạn có thể tìm hiểu thêm về cấu trúc chuyên sâu của hệ thống tại thư mục `docs/`:
- **[Architecture & Data Model](./docs/architecture/architecture.md)**: Sơ đồ tương tác các module và biểu đồ cơ sở dữ liệu (MongoDB Schema).
- **[OpenAPI / Swagger](./docs/openapi.yaml)**: Tài liệu mô tả RESTful API Contracts.
- **[Runbooks](./docs/runbooks.md)**: Sổ tay xử lý sự cố (Troubleshooting), backup, secret rotation.
- **[Security Policy](../SECURITY.md)**: Hướng dẫn báo cáo và xử lý lỗi bảo mật an toàn.

## 📐 Tuân thủ nguyên tắc S.O.L.I.D
1. **S - Đơn Trách Nhiệm**: Phân chia rõ ràng Layered Architecture (Controller, Service, Repository).
2. **O - Đóng/Mở**: Áp dụng **State Design Pattern** thay vì dùng `if/else` lớn cho việc xử lý trạng thái phỏng vấn.
3. **L - Thay thế Liskov**: Các trạng thái phỏng vấn cụ thể đều thỏa mãn giao diện `IInterviewState`.
4. **I - Phân tách Interface**: Các giao diện như `IInterviewRepository` chỉ chứa các hàm cần thiết.
5. **D - Đảo ngược Dependency**: Cắm (Inject) các Interface bằng `TSyringe` giúp mã không phụ thuộc trực tiếp vào Implementation cụ thể (dễ dàng đổi Mock AI và Gemini AI).
