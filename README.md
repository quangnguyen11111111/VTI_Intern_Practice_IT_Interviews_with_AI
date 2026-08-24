# VTI Intern Practice: IT Interviews with AI

Đây là hệ thống phỏng vấn giả lập bằng AI dành cho các ứng viên IT, giúp thực hành và đánh giá kỹ năng chuyên môn trước các kỳ phỏng vấn thực tế.

## 🚀 Tiến độ dự án (Đã làm được gì?)

Tính đến thời điểm hiện tại, dự án đã hoàn thành các hạng mục cốt lõi sau:
1. **Thiết lập Base Project:** Setup thành công frontend (React) và backend (Node.js/Express) với TypeScript, cấu hình strict type-checking, ESLint và chuẩn commit.
2. **Interview Session State Machine:** Xây dựng thành công máy trạng thái (State Machine) quản lý vòng đời của một phiên phỏng vấn (từ `PENDING` -> `GENERATING` -> `IN_PROGRESS` -> `EVALUATING` -> `COMPLETED` hoặc `FAILED`).
3. **API Endpoints:** Hoàn thiện bộ API RESTful cho phiên phỏng vấn:
   - `POST /api/v1/interviews`: Tạo phiên phỏng vấn mới.
   - `GET /api/v1/interviews/:id`: Lấy trạng thái hiện hành (Dùng để chống lỗi F5/Reload trang).
   - `POST /api/v1/interviews/:id/generate`: Yêu cầu AI sinh câu hỏi (Tự động chuyển trạng thái).
   - `POST /api/v1/interviews/:id/submit`: Nộp bài và yêu cầu AI chấm điểm.
4. **Cơ chế Idempotency & Chống Spam:** Khắc phục triệt để lỗi người dùng refresh (F5) trang liên tục hoặc spam click nhờ vào kiến trúc State Pattern. Request gọi sai thời điểm sẽ bị chặn ngay lập tức.
5. **Typescript Strict Typing:** Đã loại bỏ hoàn toàn kiểu dữ liệu `any`, áp dụng các interface rõ ràng để đảm bảo an toàn mã nguồn.
6. **Authentication, Session & Password Lifecycle (AIP-15/16/17/19/20):**
   - **Xác thực & Quản lý phiên:** JWT access tokens (15 phút), refresh tokens (7 ngày) với cơ chế Refresh Token Rotation và Replay Detection tự động thu hồi toàn bộ token family khi phát hiện token tái sử dụng.
   - **Vô hiệu hóa Stale Access Token:** Quản lý `credentialVersion` độc lập với `authVersion`. Khi người dùng đổi mật khẩu, đặt lại mật khẩu hoặc bị khóa tài khoản, `credentialVersion` được tăng nguyên tử trong transaction để ngay lập tức vô hiệu hóa toàn bộ access token cũ trên mọi thiết bị mà không ảnh hưởng tới multi-session trong quá trình đăng nhập/refresh thông thường.
   - **Distributed Atomic Rate Limiter:** Cơ chế giới hạn tỷ lệ đặt lại mật khẩu phân tán trên MongoDB (`PasswordResetRateLimit`) với 60 giây cooldown và tối đa 5 yêu cầu/giờ lăn (rolling hour). Sử dụng conditional reservation nguyên tử ngăn chặn hoàn toàn việc gửi email trùng lặp khi có nhiều request đồng thời.
   - **OpenAPI 3.1 Machine-Verified Specification:** Đặc tả đầy đủ 11 endpoints xác thực, quản trị và hồ sơ tại `docs/openapi-auth-profile.json`, được kiểm thử tự động không phụ thuộc thư viện ngoài qua `tests/openapi-auth-profile.contract.test.ts`.

## 🛠️ Công nghệ sử dụng
- **Backend:** Node.js, Express.js, TypeScript.
- **Frontend:** React, Vite (hoặc tương đương).
- **Database:** MongoDB (sử dụng Mongoose) - Multi-Document Transactions trên Replica Set.
- **Mẫu Thiết Kế (Design Patterns):** State Pattern, Layered Architecture, Dependency Injection.

## 📐 Tuân thủ nghiêm ngặt nguyên tắc S.O.L.I.D

Dự án được thiết kế cấu trúc thư mục và viết code theo đúng 5 nguyên tắc S.O.L.I.D để đảm bảo dễ bảo trì và mở rộng:

1. **S - Single Responsibility Principle (Đơn Trách Nhiệm):**
   - **Cách áp dụng:** Phân chia rõ ràng Layered Architecture. `InterviewController` chỉ lo nhận HTTP Request và Response. `InterviewService` chỉ lo điều phối logic nghiệp vụ. Các thao tác DB được giao hẳn cho `InterviewRepository`. Mỗi `State` class (như `PendingState`, `InProgressState`) chỉ chịu trách nhiệm cho các hành vi nằm trong chính trạng thái đó.

2. **O - Open/Closed Principle (Đóng/Mở):**
   - **Cách áp dụng:** Thay vì dùng các lệnh `if/else` hoặc `switch/case` khổng lồ để kiểm tra trạng thái phỏng vấn (ví dụ: `if (status === 'PENDING')`), hệ thống sử dụng **State Design Pattern**. Nếu tương lai cần thêm trạng thái `PAUSED` (Tạm dừng), ta chỉ việc tạo class `PausedState` mới implement `IInterviewState` mà không cần sửa đổi mã nguồn của Context hay Service hiện tại.

3. **L - Liskov Substitution Principle (Thay thế Liskov):**
   - **Cách áp dụng:** `InterviewContext` tương tác với các state thông qua interface `IInterviewState`. Bất kỳ state cụ thể nào (như `GeneratingState`, `CompletedState`) cũng có thể thay thế cho nhau vào biến `this.state` trong Context mà không làm phá vỡ logic chương trình. Nếu một State không hỗ trợ hàm đó, nó sẽ ném ra `InvalidStateTransitionException` đúng chuẩn quy định của Interface.

4. **I - Interface Segregation Principle (Phân tách Interface):**
   - **Cách áp dụng:** Các interface được thiết kế nhỏ gọn và đúng mục đích. Ví dụ, `IInterviewRepository` chỉ chứa các hàm cần thiết để quản lý Interview (`create`, `findById`, `updateStatus`, `update`). Tránh việc phình to một interface ép các class phải implement những hàm không cần thiết.

5. **D - Dependency Inversion Principle (Đảo ngược Dependency):**
   - **Cách áp dụng:** `InterviewService` không phụ thuộc trực tiếp vào class `InterviewRepository` (concrete), mà phụ thuộc vào bản vẽ (abstraction) là `IInterviewRepository`. Điều này cho phép chúng ta dễ dàng thực hiện **Dependency Injection (DI)**. Hiện tại hệ thống đang inject bản In-Memory DB, nhưng sau này có thể dễ dàng thay bằng Prisma hay Mongoose Repository mà không cần sửa đổi Service. Tương tự, AI Service cũng được thiết kế dưới dạng interface để Inject vào các hàm `generate` và `submit`.

## Prerequisites & Database Requirements

### MongoDB Replica Set Requirement (AIP-16 Authentication)

- **Multi-Document Transactions:** The AIP-16 authentication module uses MongoDB multi-document transactions for registration, login session creation, refresh-token rotation, replay revocation, logout, and account locking.
- **Runtime Requirement:** MongoDB must run as a replica set (for example, `--replSet rs0`) or behind `mongos`. Standalone `mongod` instances are not supported for authentication write operations because MongoDB transactions require a replica set or sharded cluster.
- **Testing Setup:** `tests/auth.integration.test.ts` uses `MongoMemoryReplSet` from `mongodb-memory-server`, so the integration tests do not require an external MongoDB instance.
