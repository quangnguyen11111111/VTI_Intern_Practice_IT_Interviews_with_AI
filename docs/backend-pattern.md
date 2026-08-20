# Backend Pattern Guideline

Tài liệu này quy định cấu trúc và cách viết code chuẩn cho phần Backend của dự án.

## 1. Mongoose Models (`src/models/`)

Mỗi Model cần được viết trọn vẹn trong một file theo chuẩn sau:
- **Tên file**: Dạng số ít, kết thúc bằng `.model.ts` (ví dụ: `user.model.ts`, `question.model.ts`).
- **Cấu trúc bên trong file**:
  1. **Interface**: Định nghĩa interface `I[ModelName]` extends `Document` để TypeScript hiểu được cấu trúc.
  2. **Schema**: Định nghĩa `[modelName]Schema` với kiểu dữ liệu, các ràng buộc (`required`, `unique`, `enum`, v.v.) và options (luôn ưu tiên bật `timestamps: true`).
  3. **Indexes**: Khai báo các field cần index (như `email`, `role`, `status`) bằng `schema.index({ field: 1 })` để tối ưu performance truy vấn.
  4. **Model Export**: Khởi tạo và `export default` Model.

**Ví dụ tham khảo**: Xem file [`src/models/user.model.ts`](file:///c:/Quang_Database/VTI_Intern_Practice_IT_Interviews_with_AI/src/models/user.model.ts).

## 2. Seeding Dữ Liệu (`src/seeds/`)

Quy trình tạo dữ liệu mẫu (Seeding) được chia thành các file riêng biệt:
- **`[model].seed.ts`**: Chứa hàm thực hiện logic xóa dữ liệu cũ (`deleteMany`) và tạo dữ liệu mới (`insertMany`) cho một collection duy nhất. Nên tận dụng thư viện `@faker-js/faker` để tạo dữ liệu ngẫu nhiên đa dạng (email, tên, mô tả).
- **`index.ts`**: Là file chạy chính, chịu trách nhiệm kết nối đến Database (Mongoose), gọi lần lượt tất cả các hàm seed từ các file `.seed.ts`, và tự động ngắt kết nối khi hoàn tất.

**Cách chạy Seeder:**
Chạy lệnh sau tại thư mục gốc:
```bash
npm run db:seed
```

> [!WARNING]
> Lệnh `db:seed` sẽ tự động xóa sạch dữ liệu cũ trong Database trước khi seed dữ liệu mới. KHÔNG CHẠY TRÊN MÔI TRƯỜNG PRODUCTION.
