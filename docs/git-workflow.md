# Hướng dẫn quy trình làm việc với Git (Git Workflow)

Dự án này áp dụng quy trình kiểm soát chặt chẽ đối với Git nhằm đảm bảo lịch sử mã nguồn sạch sẽ, dễ theo dõi.

## 1. Quy tắc đặt tên nhánh (Branch Naming)

Khi nhận một task mới, bạn BẮT BUỘC phải tạo nhánh mới từ `main` theo cú pháp sau:
**`<loại-nhánh>/<mã-task>-<mô-tả-ngắn>`**

Các loại nhánh (Type) hợp lệ:
- `feature/` (hoặc `feat/`): Khi làm tính năng mới.
- `bugfix/` (hoặc `fix/`): Khi sửa lỗi thường.
- `hotfix/`: Khi sửa lỗi khẩn cấp trên production.
- `refactor/`: Khi tái cấu trúc code.
- `release/`: Khi chuẩn bị phiên bản release.

**Ví dụ hợp lệ:**
- `feature/FND-03-setup-model`
- `bugfix/AIP-15-fix-login`

> [!CAUTION]
> Hệ thống Husky đã được cài đặt tự động kiểm tra tên nhánh khi bạn thực hiện `git commit`. Nếu tên nhánh sai chuẩn, bạn sẽ KHÔNG THỂ commit code!

## 2. Quy tắc viết thông điệp Commit (Commit Message)

Dự án áp dụng chuẩn **Conventional Commits**. Mỗi commit message phải tuân theo định dạng:
**`<loại>(<phạm vi không bắt buộc>): <mô tả ngắn>`**

**Các loại commit (Type):**
- `feat:` Thêm tính năng mới
- `fix:` Sửa lỗi
- `chore:` Các tác vụ linh tinh, cấu hình (không làm thay đổi code production)
- `docs:` Cập nhật tài liệu
- `style:` Chỉnh sửa format, dấu cách, dấu phẩy (không đổi logic code)
- `refactor:` Cấu trúc lại code (không thêm tính năng, không sửa lỗi)
- `test:` Thêm hoặc sửa test cases

**Ví dụ hợp lệ:**
- `feat: add login API`
- `fix(auth): resolve token expiration bug`
- `docs: update git workflow documentation`

> [!WARNING]
> Husky kết hợp với `commitlint` sẽ quét message của bạn. Nếu bạn viết sai định dạng (ví dụ `git commit -m "update code"`), commit sẽ bị từ chối ngay lập tức.
