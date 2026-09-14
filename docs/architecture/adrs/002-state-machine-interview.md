# ADR 002: Interview Lifecycle Management via State Pattern

**Trạng thái:** Đã chấp thuận (Accepted)
**Ngày tạo:** 14/09/2026

## 1. Ngữ cảnh (Context)
Một phiên phỏng vấn (Interview Session) trải qua nhiều giai đoạn: `PENDING` (chờ xử lý), `GENERATING` (đang gọi AI sinh câu hỏi), `IN_PROGRESS` (đang phỏng vấn), `EVALUATING` (đang chấm điểm), và `COMPLETED` / `FAILED`.

Vấn đề thường gặp: Người dùng bấm (spam) nút sinh câu hỏi quá nhiều lần, hoặc tải lại (F5) trình duyệt và cố gắng nộp bài lại. Nếu dùng các câu lệnh `if (status === ...)` ở mọi API, code sẽ rất rối rắm, khó bảo trì và dễ sinh ra lỗ hổng trạng thái (Race conditions).

## 2. Quyết định (Decision)
Thay vì sử dụng hàng loạt câu lệnh `if-else` trong Controller hoặc Service, chúng ta áp dụng **State Design Pattern**. 

Thiết lập một class `InterviewContext` để đại diện cho phiên phỏng vấn. Các logic xử lý sẽ không được viết cứng (hardcode) trong Context, mà ủy quyền (delegate) qua giao diện `IInterviewState`. 

Mỗi trạng thái (ví dụ: `PendingState`, `InProgressState`) là một Class triển khai (implement) giao diện này. Nếu Client gọi API `submitAnswers` khi phiên phỏng vấn đang ở trạng thái `PENDING`, `PendingState.submitAnswers()` sẽ được kích hoạt, hàm này mặc định ném ra ngoại lệ `InvalidStateTransitionException` vì đây là hành vi không hợp lệ. Hành vi `submitAnswers` chỉ được thực hiện thành công ở trong `InProgressState`.

## 3. Hệ quả (Consequences)
**Tích cực:**
- Nguyên tắc Open/Closed được tuân thủ. Nếu muốn thêm tính năng "Tạm dừng" (`PAUSED`), ta chỉ việc tạo thêm class `PausedState` mà không cần sửa chữa bất kì `if-else` block nào ở các lớp hiện tại.
- Code Controller và Service trở nên cực kỳ sạch (Clean Code), nó chỉ gọi `context.generateQuestions()` hoặc `context.submitAnswers()` mà không cần bận tâm hệ thống đang đứng ở bước nào.

**Tiêu cực:**
- Số lượng class khởi tạo nhiều hơn (mỗi trạng thái là 1 class).
- Yêu cầu lập trình viên mới phải hiểu vững Design Pattern trước khi có thể can thiệp sửa chữa luồng chạy gốc. Tuy nhiên, nó đáng giá cho độ ổn định của một ứng dụng chịu tải cao.
