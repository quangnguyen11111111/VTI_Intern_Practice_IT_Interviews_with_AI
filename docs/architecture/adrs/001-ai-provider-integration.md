# ADR 001: AI Provider Integration Strategy

**Trạng thái:** Đã chấp thuận (Accepted)
**Ngày tạo:** 14/09/2026

## 1. Ngữ cảnh (Context)
Hệ thống yêu cầu tích hợp với các mô hình AI ngôn ngữ lớn (LLM) như Google Gemini để có thể sinh câu hỏi và đánh giá câu trả lời của ứng viên tự động. Tuy nhiên, trong quá trình phát triển (development), việc gọi liên tục tới API thật (như Google AI Studio) sẽ gây tốn kém chi phí, dễ đạt giới hạn (Rate Limits), và làm chậm quá trình testing.

## 2. Quyết định (Decision)
Chúng ta sẽ áp dụng **Strategy Pattern** và **Dependency Injection (DI)** thông qua thư viện `tsyringe` để quản lý các nhà cung cấp AI.

Thay vì gọi trực tiếp SDK của Google trong Service, chúng ta định nghĩa một giao diện chung `IAiProvider`.

Hai implementation chính được xây dựng:
1. `GeminiAiProvider`: Sử dụng Google Generative AI SDK, gọi mô hình `gemini-1.5-flash` và ép kiểu trả về bằng cấu trúc JSON Schema (`responseSchema`).
2. `MockAiProvider`: Chạy giả lập offline, trả về cấu trúc dữ liệu JSON hệt như API thật bằng cách kết hợp hàm `setTimeout` giả lập thời gian trễ.

Hệ thống sẽ lựa chọn sử dụng Provider nào lúc runtime thông qua cấu hình Dependency Injection trong `di.ts`.

## 3. Hệ quả (Consequences)
**Tích cực:**
- Quá trình phát triển Frontend và Backend có thể được đẩy nhanh nhờ `MockAiProvider` (không cần mạng, không bị block do Rate Limits).
- Dễ dàng thay đổi hoặc thêm nhà cung cấp AI khác trong tương lai (Ví dụ: OpenAI ChatGPT, Anthropic Claude) chỉ cần tạo class mới implement `IAiProvider` mà không làm thay đổi core logic.
- Dễ dàng viết Unit Test cho `InterviewService`.

**Tiêu cực:**
- Phải bảo trì cấu trúc JSON Schema (Zod) cho cả phần gọi thật và phần Mock. Đôi khi Mock hoạt động hoàn hảo nhưng API thật lại trả về lỗi format. Để giải quyết, chúng ta bổ sung các class Security/Retry (Exponential Backoff) bọc xung quanh lớp Provider thật.
