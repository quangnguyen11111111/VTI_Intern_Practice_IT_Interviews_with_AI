# VTI AI Interview - Sổ Tay Vận Hành (Runbooks)

Tài liệu này cung cấp các hướng dẫn từng bước để xử lý các sự cố thường gặp (Troubleshooting) và các nghiệp vụ quản trị hệ thống (Administration) trên môi trường Production.

---

## 1. Xử lý sự cố (Incident Response)

### 1.1 Lỗi AI Provider (Timeout / 502 / 503)
**Triệu chứng:** Người dùng báo cáo không thể tạo câu hỏi hoặc chấm điểm. Log backend ghi nhận lỗi `AI_PROVIDER_UNAVAILABLE` hoặc `AI_OUTPUT_INVALID`.
**Nguyên nhân:** Có thể do Google Gemini API bị rate limit, server Google phản hồi chậm, hoặc API thay đổi cấu trúc trả về khiến JSON parser bị lỗi.
**Khắc phục:**
1. Kiểm tra log chi tiết:
   ```bash
   tail -n 100 backend/logs/error.log | grep "GeminiAiProvider"
   ```
2. Nếu là lỗi Rate Limit (`429`), hệ thống đã tự động retry (Exponential Backoff). Nếu vẫn thất bại, hãy thông báo tạm thời cho người dùng.
3. Nếu lỗi là `AI_OUTPUT_INVALID`, kiểm tra lại Zod Schema trong `src/services/ai/prompt-security.ts`. Có thể AI trả về kiểu string thay vì number. Nới lỏng Zod Schema (dùng `z.coerce`) hoặc cập nhật System Prompts.
4. (Tuỳ chọn) Đổi sang `MockAiProvider` tạm thời để đảm bảo ứng dụng không bị chết cứng nếu Google sập hoàn toàn:
   Mở file `.env` và đổi:
   `AI_PROVIDER=MOCK`
   Khởi động lại backend.

### 1.2 Mất kết nối SSE (Server-Sent Events)
**Triệu chứng:** Client bị treo ở màn hình "Đang tạo câu hỏi..." dù backend đã sinh xong.
**Nguyên nhân:** Proxy hoặc Load Balancer cắt kết nối (timeout) do không có dữ liệu trả về trong thời gian dài (vd > 30s).
**Khắc phục:**
1. Kiểm tra cấu hình Nginx/Caddy. Đảm bảo cấu hình `proxy_read_timeout` ít nhất là `300s`.
2. Kiểm tra log backend xem có lỗi `socket hang up` không.
3. Giải pháp code (đã có): Hệ thống tự động gửi "ping" mỗi 15s để giữ kết nối. Nếu Client mất mạng, họ có thể F5 để fetch lại `Status`.

---

## 2. Quản trị định kỳ (Administration)

### 2.1 Đảo mã khóa (Secret Rotation)
Key bị lộ là rủi ro cực lớn. Khi cần thay thế:
1. Đổi `JWT_SECRET`:
   - Tạo chuỗi mới ngẫu nhiên (`openssl rand -hex 64`).
   - Cập nhật vào `.env`.
   - *Lưu ý: Tất cả người dùng hiện tại sẽ bị văng ra ngoài (log out) và phải đăng nhập lại.*
2. Đổi `GEMINI_API_KEY`:
   - Truy cập Google AI Studio, thu hồi (revoke) key cũ.
   - Tạo key mới, thay thế vào `.env`.
   - Khởi động lại service: `npm run build && npm start` (hoặc `docker-compose restart backend`).

### 2.2 Sao lưu và Phục hồi Database (Backup/Restore)
**Backup (Tạo bản sao lưu):**
```bash
# Thay thế MONGODB_URI bằng URI thực tế của bạn
mongodump --uri="mongodb://localhost:27017/vti-ai-interview" --out=/backups/vti_$(date +%F)
```
**Restore (Khôi phục):**
```bash
mongorestore --uri="mongodb://localhost:27017/vti-ai-interview" /backups/vti_2026-09-14
```
*Lưu ý: Khi Restore, hãy chắc chắn Replica Set đang hoạt động bình thường.*

### 2.3 Rollback Code (Quay lui phiên bản)
Nếu bản deploy mới nhất gây sập server (Critical Bug):
1. Quay lại commit an toàn:
   ```bash
   git log --oneline # Tìm mã commit an toàn
   git checkout <commit-hash>
   ```
2. Cài lại thư viện và build:
   ```bash
   npm ci
   npm run build
   ```
3. Restart process (PM2 hoặc Docker):
   ```bash
   pm2 restart backend
   ```
