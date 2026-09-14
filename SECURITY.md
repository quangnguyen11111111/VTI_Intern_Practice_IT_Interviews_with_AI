# Chính sách Bảo mật (Security Policy)

Cảm ơn bạn đã quan tâm đến việc đảm bảo an toàn cho dự án `VTI AI Interview`. Vấn đề bảo mật hệ thống được chúng tôi đặt lên hàng ưu tiên số một.

## Các phiên bản được hỗ trợ (Supported Versions)

Chúng tôi cung cấp các bản vá bảo mật (security updates) cho nhánh chính (main/master) mới nhất. Nếu bạn đang tự host (self-hosted) dự án này, vui lòng đảm bảo bạn luôn pull code mới nhất từ repository.

| Phiên bản | Trạng thái hỗ trợ |
| --------- | ----------------- |
| > 1.0.x   | ✅ Được hỗ trợ |
| < 1.0.0   | ❌ Ngừng hỗ trợ |

## Cách báo cáo Lỗ hổng Bảo mật (Reporting a Vulnerability)

> [!WARNING]
> Tuyệt đối **KHÔNG** tạo Issue công khai (Public Issue) trên GitHub cho các lỗi bảo mật. Việc này có thể khiến tin tặc lợi dụng để tấn công hệ thống trước khi chúng tôi kịp tung bản vá.

Nếu bạn phát hiện bất kỳ rủi ro hay lỗ hổng bảo mật nào (vd: SQL/NoSQL Injection, rò rỉ JWT, lộ API Key), vui lòng báo cáo theo quy trình sau:

1. **Gửi Email bí mật**: Gửi báo cáo chi tiết đến địa chỉ email: `security@vti.com.vn`.
2. **Nội dung Email cần có**:
   - Loại lỗ hổng (XSS, RCE, IDOR, v.v.).
   - Các bước tái hiện (Steps to reproduce).
   - Đoạn code POC (Proof of Concept) hoặc video minh chứng (nếu có).
3. **Quá trình phản hồi**:
   - Đội ngũ kỹ sư sẽ tiếp nhận và xác nhận email của bạn trong vòng **48 giờ**.
   - Nếu lỗ hổng là chính xác, chúng tôi sẽ cấp tốc tiến hành sửa chữa trên một nhánh Private.
   - Khi bản vá được công bố, bạn sẽ được ghi nhận (Credits) trong Release Note nếu bạn mong muốn.

## Các cơ chế bảo mật cốt lõi đang áp dụng
- **Auth**: Sử dụng JWT với thời gian sống (expiration) ngắn và được mã hóa HMAC.
- **Database**: 
  - Khuyến cáo mã hóa dữ liệu MongoDB at-rest.
  - Vô hiệu hóa (disable) query Injection bằng Mongoose ODM.
- **Mật khẩu**: Hash một chiều bằng `bcrypt` (Salt round = 10) trước khi lưu vào DB.
- **AI Prompts**: 
  - Có cơ chế chặn (Sanitize) Injection Prompt (e.g. "Ignore previous instructions").
  - Validation dữ liệu gắt gao bằng Schema `zod` trước khi nhận JSON từ Gemini API.
