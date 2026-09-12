# Kế hoạch và prompt triển khai đăng ký/đăng nhập bằng Google

## 1. Mục tiêu

Bổ sung đăng ký và đăng nhập bằng Google cho ứng dụng hiện tại, đồng thời giữ nguyên cơ chế xác thực nội bộ đang dùng:

- Google Identity Services (GIS) hiển thị nút đăng nhập trên SPA React.
- Frontend nhận Google ID token từ callback của GIS và gửi token qua `POST /api/v1/auth/google`.
- Backend tự xác minh chữ ký và các claim của ID token trước khi tin tưởng danh tính.
- Sau khi xác minh, backend phát hành access token và refresh token nội bộ giống đăng nhập bằng mật khẩu.
- Một endpoint Google duy nhất phục vụ cả đăng ký mới và đăng nhập lại.
- Không thay đổi dependency hoặc lockfile; sử dụng `jsonwebtoken`, `crypto` và `fetch` đã có trong runtime.

## 2. Hiện trạng cần giữ nguyên

Backend hiện dùng Express, TypeScript, Mongoose và MongoDB transaction. Luồng auth hiện có gồm:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- Access token và refresh token nội bộ.
- Refresh-token rotation, token hash trong MongoDB và session ID/JTI.
- `authVersion`, `credentialVersion`, trạng thái `ACTIVE`, `INACTIVE`, `LOCKED`.
- Rate limiting cho đăng ký và đăng nhập.
- Response chuẩn `ApiResponse<AuthResponseData>` và `SafeUser`.

Frontend hiện dùng React, Vite, Zustand và `sessionStorage`:

- Access token chỉ giữ trong memory.
- Refresh token giữ trong `sessionStorage`.
- Sau đăng nhập, user được lưu vào Zustand và điều hướng bằng `roleLanding`.
- Trang đăng nhập có hỗ trợ quay lại đường dẫn ban đầu.

Tính năng Google phải tái sử dụng toàn bộ các quy ước trên, không tạo một hệ session riêng.

## 3. Kiến trúc đã quyết định

### 3.1 Luồng frontend

1. Nạp duy nhất script chính thức `https://accounts.google.com/gsi/client`.
2. Khởi tạo GIS bằng `VITE_GOOGLE_CLIENT_ID`.
3. Render nút Google chính thức trên cả trang đăng nhập và đăng ký.
4. Callback chỉ nhận `credential` và gửi:

   ```json
   {
     "credential": "<google-id-token>"
   }
   ```

5. Khi backend thành công, chỉ lưu access/refresh token nội bộ; không lưu Google ID token.
6. Cập nhật Zustand và điều hướng giống đăng nhập bằng mật khẩu.

### 3.2 Xác minh Google ID token ở backend

Backend không được decode token rồi tin claim. Quy trình bắt buộc:

1. Giới hạn kích thước `credential` ngay tại validator.
2. Decode header chỉ để lấy `alg` và `kid`.
3. Chỉ chấp nhận `alg=RS256` và `kid` hợp lệ.
4. Lấy Google JWKS từ endpoint HTTPS chính thức.
5. Cache JWKS theo `Cache-Control: max-age`, có giới hạn thời gian hợp lý và dùng chung promise khi nhiều request cùng tải key.
6. Nếu `kid` chưa có trong cache, buộc refresh JWKS tối đa một lần để hỗ trợ key rotation.
7. Dùng public key tương ứng để kiểm tra:

   - Chữ ký RS256.
   - `aud` bằng chính xác `GOOGLE_CLIENT_ID`.
   - `iss` là `accounts.google.com` hoặc `https://accounts.google.com`.
   - Token chưa hết hạn.
   - `email_verified === true`.
   - `sub`, `email` và các claim sử dụng đều đúng kiểu và nằm trong giới hạn độ dài.

8. Chỉ nhận avatar là URL HTTPS hợp lệ.
9. Không log, trả về hoặc đưa raw credential/decoded token vào lỗi.

Lỗi token giả mạo, sai audience, sai issuer, hết hạn, email chưa xác minh hoặc claim sai phải dùng chung lỗi `401 AUTH_INVALID_GOOGLE_CREDENTIAL`. Lỗi chưa cấu hình dùng `503 AUTH_GOOGLE_NOT_CONFIGURED`; lỗi không tải được JWKS dùng `503 AUTH_GOOGLE_UNAVAILABLE`.

### 3.3 Mô hình tài khoản

Mở rộng `User` như sau:

- `passwordHash` trở thành optional nhưng vẫn `select: false`.
- Thêm `googleSubject?: string`, `select: false`.
- `googleSubject` có unique sparse index và giới hạn độ dài.
- Không đặt `default: null` cho field dùng sparse unique index.
- Không đưa `googleSubject` vào `SafeUser`, `toJSON` hoặc `toObject`.

`sub` của Google là khóa liên kết ổn định. Email không được dùng làm định danh Google cho những lần đăng nhập tiếp theo.

### 3.4 Quy tắc tạo và liên kết tài khoản

Sau khi token đã được xác minh:

1. Tìm user bằng `googleSubject` trước.
2. Nếu tìm thấy, dùng đúng user đó; không đổi quyền sở hữu theo email mới trong token.
3. Nếu chưa có `googleSubject`, tìm user bằng email chuẩn hóa.
4. Nếu chưa tồn tại email, tạo user:

   - `role=CANDIDATE`
   - `status=ACTIVE`
   - Không tạo mật khẩu giả.
   - Lưu `googleSubject`.
   - Dùng tên/avatar đã xác minh, có fallback tên an toàn.

5. Nếu email đã tồn tại, chỉ tự liên kết khi Google có thẩm quyền với email:

   - Email kết thúc bằng `@gmail.com`; hoặc
   - `email_verified=true` và có claim `hd` của Google Workspace.

6. Nếu email bên thứ ba không có `hd` trùng với tài khoản local, từ chối bằng `409 AUTH_GOOGLE_ACCOUNT_LINK_REQUIRED`. Không tự liên kết vì quyền sở hữu email bên thứ ba có thể đã thay đổi.
7. Nếu user đã liên kết với một `googleSubject` khác, từ chối conflict; không được ghi đè subject cũ.
8. Khi liên kết vào user local, giữ nguyên tên và avatar hiện tại của user.
9. Xử lý duplicate-key race bằng retry/re-read có giới hạn để hai request đồng thời không tạo hai user hoặc liên kết sai tài khoản.

### 3.5 Trạng thái và session

- User `LOCKED` trả `403 AUTH_ACCOUNT_LOCKED`.
- User `INACTIVE` không được đăng nhập.
- Tăng `authVersion` theo cùng quy tắc của đăng nhập mật khẩu.
- Tạo refresh session trong cùng MongoDB transaction.
- Refresh token chỉ được lưu dưới dạng hash.
- Access/refresh token mới phải mang role và `credentialVersion` hiện tại trong database.
- Tài khoản Google-only đăng nhập bằng mật khẩu phải trả generic `AUTH_INVALID_CREDENTIALS`, không được làm `bcrypt.compare` với `undefined` và không tiết lộ phương thức đăng nhập đã đăng ký.

## 4. Endpoint mới

### Request

```http
POST /api/v1/auth/google
Content-Type: application/json
```

```json
{
  "credential": "google-id-token"
}
```

Body phải strict và chỉ chấp nhận `credential` là chuỗi không rỗng với giới hạn độ dài bảo thủ, ví dụ 8.192 ký tự.

### Success

```json
{
  "success": true,
  "message": "Đăng nhập bằng Google thành công",
  "data": {
    "user": {},
    "tokens": {
      "accessToken": "...",
      "refreshToken": "..."
    }
  }
}
```

Endpoint phải dùng cùng login rate limiter hiện tại.

## 5. Browser security

Cấu hình Helmet vừa đủ cho GIS:

- Cho phép script chính thức của Google Identity Services.
- Cho phép frame/connect/style source cần thiết của GIS.
- Đặt `Cross-Origin-Opener-Policy: same-origin-allow-popups` cho popup Google.
- Cho phép ảnh hồ sơ từ Google-hosted image origin nếu lưu avatar Google.
- Giữ nguyên các Helmet protection khác.
- Không thêm inline executable script.

## 6. Kế hoạch thay đổi theo file

### Backend

- `src/config/env.ts`
  - Thêm `GOOGLE_CLIENT_ID` optional, trim, mặc định chuỗi rỗng.
  - App vẫn khởi động khi chưa cấu hình; riêng endpoint Google phải fail closed.

- `src/models/user.model.ts`
  - Cho phép thiếu `passwordHash`.
  - Thêm `googleSubject` nội bộ và unique sparse index.
  - Bảo đảm transform không lộ field auth nội bộ.

- `src/services/google-identity.service.ts` — file mới
  - Xác minh Google ID token.
  - Quản lý cache JWKS, in-flight fetch, timeout và key rotation.
  - Chuẩn hóa verified identity.

- `src/services/auth.service.ts`
  - Thêm `loginWithGoogle`.
  - Tái sử dụng logic phát hành application session.
  - Xử lý create/link/race/status trong transaction.
  - Sửa password login cho user không có `passwordHash`.

- `src/validators/auth.validator.ts`
  - Thêm strict schema cho Google credential.

- `src/controllers/auth.controller.ts`
  - Thêm handler Google.

- `src/routes/auth.routes.ts`
  - Thêm `POST /google` với login rate limiter.

- `src/app.ts`
  - Cấu hình CSP và COOP cho GIS.

### Frontend

- `client/src/types/google-identity.d.ts` — file mới
  - Khai báo tối thiểu type cho `window.google.accounts.id`.

- `client/src/auth/googleIdentity.ts` — file mới
  - Singleton script loader và GIS initialization.
  - Chia sẻ concurrent load; cleanup callback khi unmount.

- `client/src/auth/apiClient.ts`
  - Thêm `googleLogin`.
  - Đưa `auth/google` vào nhóm endpoint không được kích hoạt refresh recursion.

- `client/src/features/auth/GoogleSignInButton.tsx` — file mới
  - Render nút GIS chính thức.
  - Có busy, error và cleanup state.
  - Không hoạt động khi thiếu `VITE_GOOGLE_CLIENT_ID`.

- `client/src/pages/LoginPage.tsx`
  - Thêm separator và nút Google.
  - Thành công phải giữ `returnPath` hiện tại.

- `client/src/pages/RegisterPage.tsx`
  - Thêm separator và nút Google.
  - Thành công điều hướng bằng `roleLanding`.

### Contract, test và tài liệu

- `tests/google-identity.unit.test.ts` — file mới.
- `tests/google-auth.integration.test.ts` — file mới.
- `tests/openapi-auth-profile.contract.test.ts` — bổ sung route/schema.
- `docs/openapi-auth-profile.json` — mô tả endpoint và lỗi mới.
- `.env.example` — thêm placeholder `GOOGLE_CLIENT_ID`.
- `client/.env.example` — thêm placeholder `VITE_GOOGLE_CLIENT_ID`.

Không đưa client secret vào tính năng này. GIS ID-token flow chỉ cần Web OAuth client ID.

## 7. Kiểm thử bắt buộc

### Backend verifier

Dùng RSA key pair tạo trong memory và mock JWKS fetch; tuyệt đối không gọi Google thật trong test. Bao phủ:

- Token hợp lệ.
- Cache reuse và shared in-flight fetch.
- Refresh cache khi `kid` thay đổi.
- Sai chữ ký.
- Sai `aud`.
- Sai `iss`.
- Token hết hạn.
- `email_verified=false`.
- Claim thiếu hoặc sai kiểu.
- Thiếu `GOOGLE_CLIENT_ID`.
- JWKS timeout/lỗi response.
- Error không chứa raw credential.

### Backend integration

- Validation từ chối body thiếu/thừa/quá dài.
- Google user mới được tạo đúng một lần.
- Đăng nhập lại dùng cùng user.
- Refresh session được tạo và token chỉ lưu dưới dạng hash.
- Gmail/Workspace có thể liên kết user local cùng email.
- Email bên thứ ba không có `hd` không được tự liên kết.
- Không được thay thế `googleSubject` đã có.
- `LOCKED` và `INACTIVE` bị chặn.
- Password login cho Google-only user trả generic 401, không 500.
- Duplicate request không tạo duplicate user.
- CSP và COOP có directive cần thiết.

### Frontend

- Script GIS chỉ được nạp một lần.
- Mock `window.google`, không tải script ngoài mạng.
- Callback thành công chỉ gửi `{ credential }`.
- `auth/google` không gửi application bearer token và không refresh đệ quy.
- Google credential không vào storage/store/URL/error.
- Login giữ return path.
- Register điều hướng theo role.
- Missing config và script error được xử lý an toàn.
- Form email/password cũ tiếp tục hoạt động.

### Lệnh kiểm tra

```powershell
npm run build
npm test -- --run tests/google-identity.unit.test.ts tests/google-auth.integration.test.ts tests/openapi-auth-profile.contract.test.ts
npm test
npm --prefix client run build
npm --prefix client test -- --run src/auth/apiClient.test.ts src/features/auth/GoogleSignInButton.test.tsx src/features/auth/AuthForm.test.tsx
npm --prefix client test
```

## 8. Tiêu chí nghiệm thu

- Người dùng có thể đăng ký mới hoặc đăng nhập lại bằng cùng một nút Google.
- Google ID token được xác minh cryptographically ở backend trước khi dùng claim.
- `sub` được dùng làm định danh liên kết lâu dài.
- Không có account takeover qua email bên thứ ba không-authoritative.
- Không có password giả cho Google-only user.
- Session Google dùng đúng access/refresh token nội bộ hiện có.
- Không lộ raw credential, Google subject, password hash hoặc auth version.
- Nút Google hoạt động trên cả Login và Register khi cấu hình đúng.
- Local auth, refresh/logout, lock/RBAC, password recovery và profile không regression.
- OpenAPI, env example và hướng dẫn cấu hình được cập nhật.
- Build và test liên quan vượt qua.
- Không commit, push, rebase hoặc sửa file ngoài phạm vi.

## 9. Prompt hoàn chỉnh để giao cho Antigravity

Sao chép nguyên khối prompt dưới đây cho Antigravity:

```text
Bạn đang triển khai tính năng đăng ký/đăng nhập bằng Google trong repository hiện tại. Hãy trực tiếp chỉnh sửa source code, test và tài liệu; không chỉ phân tích hoặc viết kế hoạch.

Trước khi sửa:
1. Đọc AGENTS.md và tuân thủ toàn bộ quy tắc an toàn/repository.
2. Kiểm tra git status và bảo tồn mọi thay đổi, file untracked và công việc có sẵn của người dùng.
3. Đọc đầy đủ các file auth backend/frontend liên quan trước khi quyết định chỉnh sửa.
4. Không commit, push, rebase, reset, clean, restore hoặc xóa file.
5. Không sửa package.json, package-lock.json, client/package.json hoặc client/package-lock.json. Không thêm dependency.

Mục tiêu:
- Dùng Google Identity Services popup trên React SPA.
- Frontend nhận Google ID token rồi POST JSON { credential } tới POST /api/v1/auth/google.
- Backend xác minh token và phát hành đúng access/refresh token nội bộ hiện có.
- Một endpoint duy nhất vừa tạo tài khoản mới vừa đăng nhập tài khoản Google đã có.

Các quyết định kiến trúc bắt buộc:

A. Google token verifier
- Tạo src/services/google-identity.service.ts.
- Dùng jsonwebtoken, Node crypto và fetch hiện có; không thêm dependency.
- Decode header chỉ để lấy alg/kid; chỉ cho phép RS256 và kid hợp lệ.
- Lấy official Google JWKS qua HTTPS, có timeout.
- Cache key theo Cache-Control max-age với fallback/cap an toàn.
- Dùng chung in-flight fetch để tránh request stampede.
- Khi kid không có trong cache, force refresh tối đa một lần để xử lý key rotation.
- Verify signature, audience bằng chính xác GOOGLE_CLIENT_ID, issuer accounts.google.com hoặc https://accounts.google.com, expiry, email_verified=true và shape/length của claim.
- Chỉ chấp nhận avatar HTTPS hợp lệ.
- Dùng sub làm stable provider identifier.
- Token/claim lỗi trả generic 401 AUTH_INVALID_GOOGLE_CREDENTIAL.
- Thiếu GOOGLE_CLIENT_ID trả 503 AUTH_GOOGLE_NOT_CONFIGURED.
- JWKS không khả dụng trả 503 AUTH_GOOGLE_UNAVAILABLE.
- Không log hoặc echo raw credential, decoded token, key material hay environment value.

B. User model và account linking
- Trong src/models/user.model.ts, đổi passwordHash thành optional nhưng vẫn select:false.
- Thêm googleSubject optional, select:false, bounded, unique sparse index; không default:null.
- Xóa googleSubject khỏi toJSON/toObject và không thêm nó vào SafeUser.
- Returning user luôn được tìm bằng googleSubject trước.
- Nếu chưa có subject và chưa có email: tạo ACTIVE CANDIDATE, không tạo mật khẩu giả.
- Chỉ auto-link existing local email nếu email là @gmail.com hoặc email_verified=true cùng hd không rỗng.
- Với third-party email không có hd trùng existing local account: trả 409 AUTH_GOOGLE_ACCOUNT_LINK_REQUIRED, không link.
- Không bao giờ thay thế một googleSubject đã liên kết bằng subject khác.
- Khi link existing user, giữ nguyên fullName/avatar hiện tại.
- Xử lý duplicate-key race bằng retry/re-read có giới hạn.

C. Session và authorization
- Thêm loginWithGoogle vào auth service.
- Sau khi xác minh danh tính, dùng Mongo transaction để kiểm tra trạng thái, tăng authVersion và tạo refresh session.
- Dùng đúng generateAuthTokens, getRefreshTokenExpiry và hashToken hiện có.
- Refresh token phải được lưu dưới dạng hash; giữ nguyên rotation/sessionId/JTI/credentialVersion semantics.
- LOCKED trả AUTH_ACCOUNT_LOCKED; INACTIVE không được xác thực.
- Sửa password login: nếu user không có passwordHash, chạy dummy compare và trả generic AUTH_INVALID_CREDENTIALS, không throw 500 và không tiết lộ phương thức đăng nhập.

D. API
- Trong src/config/env.ts thêm GOOGLE_CLIENT_ID optional, trimmed, default ''. App vẫn boot được khi chưa cấu hình nhưng endpoint Google phải fail closed.
- Thêm strict validator chỉ chấp nhận credential string, non-empty, tối đa khoảng 8192 ký tự.
- Thêm handler và POST /api/v1/auth/google.
- Dùng cùng login rate limiter hiện tại.
- Success trả ApiResponse<AuthResponseData> status 200, message tiếng Việt và cùng SafeUser/tokens shape như login thường.
- Không nhận email, role, status, subject hoặc profile claim từ client.

E. Browser security
- Điều chỉnh Helmet trong src/app.ts để CSP chỉ mở các script/frame/connect/style source chính thức cần cho Google Identity Services.
- Đặt Cross-Origin-Opener-Policy thành same-origin-allow-popups.
- Cho phép Google-hosted image origin cần cho avatar.
- Giữ nguyên các Helmet protection khác và không thêm inline executable script.

F. Frontend
- Tạo client/src/types/google-identity.d.ts với type tối thiểu cho GIS.
- Tạo client/src/auth/googleIdentity.ts làm singleton loader cho https://accounts.google.com/gsi/client; concurrent calls dùng chung promise, initialize an toàn và cleanup callback khi unmount.
- Thêm googleLogin trong client/src/auth/apiClient.ts.
- Đưa auth/google vào AUTH_ENDPOINTS để không gửi application bearer token và không kích hoạt refresh recursion.
- Tạo reusable client/src/features/auth/GoogleSignInButton.tsx với accessible state, busy/error handling và cleanup.
- Khi thiếu VITE_GOOGLE_CLIENT_ID, không gửi request hỏng; ẩn hoặc disable nút với hành vi rõ ràng.
- Thêm separator và nút Google vào cả LoginPage và RegisterPage.
- Thành công chỉ lưu application access/refresh tokens bằng helper hiện tại, cập nhật Zustand và điều hướng như auth thường.
- Login phải giữ returnPath; Register dùng roleLanding.
- Không lưu Google credential vào memory store lâu dài, sessionStorage, localStorage, URL, log hoặc rendered error.

G. Test và contract
- Tạo tests/google-identity.unit.test.ts dùng RSA key pair trong memory và mocked JWKS fetch; không gọi Google thật.
- Bao phủ success, wrong signature/aud/iss, expiry, email unverified, malformed claims, cache reuse, concurrent fetch, key rotation, missing config và JWKS failure.
- Tạo tests/google-auth.integration.test.ts bao phủ create/re-login, authoritative linking, rejected third-party collision, subject conflict, locked/inactive, refresh hash, password login cho Google-only account, validation và race behavior.
- Test CSP/COOP liên quan.
- Tạo client/src/features/auth/GoogleSignInButton.test.tsx và cập nhật apiClient/AuthForm tests cho GIS success/error/missing config, storage, navigation và no-refresh boundary.
- Cập nhật docs/openapi-auth-profile.json và tests/openapi-auth-profile.contract.test.ts cho POST /api/v1/auth/google cùng response/error schemas.
- Cập nhật .env.example với GOOGLE_CLIENT_ID placeholder và client/.env.example với VITE_GOOGLE_CLIENT_ID placeholder. Không ghi client secret hoặc credential thật.

Các file chính được phép thay đổi/tạo:
- src/config/env.ts
- src/app.ts
- src/models/user.model.ts
- src/services/google-identity.service.ts
- src/services/auth.service.ts
- src/controllers/auth.controller.ts
- src/routes/auth.routes.ts
- src/validators/auth.validator.ts
- tests/google-identity.unit.test.ts
- tests/google-auth.integration.test.ts
- tests/openapi-auth-profile.contract.test.ts
- docs/openapi-auth-profile.json
- .env.example
- client/.env.example
- client/src/types/google-identity.d.ts
- client/src/auth/googleIdentity.ts
- client/src/auth/apiClient.ts
- client/src/auth/apiClient.test.ts
- client/src/features/auth/GoogleSignInButton.tsx
- client/src/features/auth/GoogleSignInButton.test.tsx
- client/src/features/auth/AuthForm.test.tsx
- client/src/pages/LoginPage.tsx
- client/src/pages/RegisterPage.tsx

Nếu cần sửa file khác, trước tiên phải giải thích lý do và bảo đảm nó thực sự cần thiết. Không chạm vào docs/pre-push-task-audit-prompt.md, docs/question-bank, AGENTS.md, .agents, .codex, .codex-runs hoặc Git metadata.

Sau khi triển khai:
1. Tự review toàn bộ diff, đặc biệt các đường dữ liệu raw Google credential và account-linking race.
2. Chạy lần lượt các kiểm tra khả dụng:
   npm run build
   npm test -- --run tests/google-identity.unit.test.ts tests/google-auth.integration.test.ts tests/openapi-auth-profile.contract.test.ts
   npm test
   npm --prefix client run build
   npm --prefix client test -- --run src/auth/apiClient.test.ts src/features/auth/GoogleSignInButton.test.tsx src/features/auth/AuthForm.test.tsx
   npm --prefix client test
3. Sửa mọi lỗi nằm trong phạm vi tính năng.
4. Kiểm tra git diff và git status lần cuối; không xử lý hoặc xóa thay đổi ngoài phạm vi.

Kết quả trả về phải ngắn gọn nhưng đủ kiểm chứng, gồm:
- Tóm tắt kiến trúc đã triển khai.
- Danh sách file đã thay đổi/tạo.
- Kết quả từng lệnh build/test.
- Các giả định cấu hình và hướng dẫn thiết lập Google OAuth Web client ID.
- Blocker hoặc phần chưa hoàn tất, nếu có.
```

## 10. Cấu hình thủ công sau triển khai

1. Tạo OAuth 2.0 Client loại Web application trong Google Cloud Console.
2. Thêm authorized JavaScript origins, tối thiểu origin localhost dùng cho Vite và origin production.
3. Đặt cùng một Web client ID vào:

   ```dotenv
   GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   VITE_GOOGLE_CLIENT_ID=your-web-client-id.apps.googleusercontent.com
   ```

4. Không tạo hoặc đưa Google client secret vào flow này.
5. Restart backend và rebuild/restart frontend sau khi đổi biến môi trường.
6. Smoke test tài khoản Google mới, tài khoản Google đã đăng nhập trước đó, tài khoản local Gmail được liên kết, tài khoản bị khóa và trường hợp cấu hình sai client ID.
