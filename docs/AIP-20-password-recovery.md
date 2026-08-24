# AIP-20 — AUTH-06 — Password Recovery & Management

## Delivery source

AIP-20 is not present in the current offline Jira catalog. This delivery is
packaged against the closed local AIP-20 control-plane handoff and the actual
repository implementation. Jira status and remote Acceptance Criteria must be
confirmed separately before changing the issue.

## Delivered behavior

### Authenticated password change

- `PATCH /api/v1/auth/password`
- Requires the authenticated user; a user identifier is never accepted from the body.
- Body: `currentPassword`, `newPassword`.
- Both values enforce the 8-character minimum and bcrypt's 72-byte maximum.
- Verifies the current password, rejects reuse, hashes the replacement, increments
  `authVersion` and `credentialVersion`, and revokes every active refresh session in one transaction.
- Invalidates all access tokens issued prior to the password change across all devices immediately.
- Concurrent changes using the same old password cannot both succeed.

### Forgot password

- `POST /api/v1/auth/password/forgot`
- Body: `email`.
- Returns the same generic `202` response for registered and unregistered addresses.
- Creates a real or synthetic record without storing raw email or OTP.
- Uses a cryptographically secure six-digit OTP with a ten-minute lifetime.
- Enforces distributed atomic MongoDB rate limiting via `PasswordResetRateLimit` with a 60-second cooldown and a maximum of 5 requests per rolling hour. Simultaneous parallel requests yield at most one delivery.
- Delivery failure invalidates the new record, releases the matching in-flight reservation and cooldown, preserves rolling-hour accounting, and returns the same retryable `503` behavior regardless of account existence.

### Reset password

- `POST /api/v1/auth/password/reset`
- Body: `email`, `otp`, `newPassword`.
- Invalid, expired, used, undelivered, or attempts-exhausted codes share one canonical error.
- Allows at most five failed verification attempts.
- Atomically consumes the OTP, so concurrent reset requests cannot both succeed.
- A real account receives a new password hash, increments `credentialVersion` and `authVersion`, and has all refresh sessions revoked in the same transaction. Prior access tokens fail on next request. A valid synthetic flow returns the same success shape without creating or changing a user.

## Data and security model

- `PasswordResetRateLimit` manages distributed atomic reservation, rolling-hour timestamps, cooldown expiry, reservation IDs, and TTL purge metadata using hashed email lookups.
- `PasswordResetOtp` stores HMAC lookups for normalized email and OTP, optional `userId`, synthetic/delivery state, attempts, expiry, use, and purge timestamps.
- `User` incorporates `credentialVersion` (internal, defaulting to 0) strictly validated in access tokens to reject stale tokens upon credential mutations while preserving multi-session logins during normal operations.
- A TTL index removes retained rate-limit records after the required window.
- Request bodies are strict and reject undeclared fields.
- Passwords, raw OTPs, tokens, SMTP credentials, and provider errors are not logged or returned by these flows.
- SMTP is accessed through an injectable provider. Production rejects the default reset secret, incomplete SMTP settings, example placeholders, and invalid secure-mode values.

## Machine-verified OpenAPI Specification

- The API contract is specified in `docs/openapi-auth-profile.json` (OpenAPI 3.1.0) covering all 11 authentication, password lifecycle, account lock, and profile routes.
- The contract is machine-verified via Vitest contract tests in `tests/openapi-auth-profile.contract.test.ts`.

## Required environment

```text
PASSWORD_RESET_SECRET=<distinct random secret with at least 32 characters>
SMTP_HOST=<smtp host>
SMTP_PORT=<1-65535>
SMTP_SECURE=<true|false|1|0>
SMTP_USER=<smtp user>
SMTP_PASS=<smtp password>
SMTP_FROM=<sender accepted by the provider>
```

Never commit real values. `.env.example` contains placeholders only.

## Frontend routes

- Guest: `/forgot-password`, `/reset-password`.
- Authenticated: `/change-password`.
- Login exposes the forgot-password link; Profile exposes the change-password link.
- Forms provide labels, password-manager autocomplete values, loading-disabled states,
  field/server feedback, success states, and navigation back to login/profile.
- Successful authenticated password change clears the local session before redirecting.

## Package manifest

The AIP-20 delivery consists of these exact paths:

```text
.env.example
package.json
package-lock.json
src/config/env.ts
src/models/user.model.ts
src/models/password-reset-otp.model.ts
src/models/password-reset-rate-limit.model.ts
src/types/auth.type.ts
src/utils/token.ts
src/middlewares/auth.middleware.ts
src/services/email.service.ts
src/services/auth.service.ts
src/controllers/auth.controller.ts
src/routes/auth.routes.ts
src/validators/auth.validator.ts
tests/auth.integration.test.ts
tests/authorization.integration.test.ts
tests/password-recovery.integration.test.ts
tests/openapi-auth-profile.contract.test.ts
client/src/App.tsx
client/src/auth/apiClient.ts
client/src/auth/schemas.ts
client/src/pages/LoginPage.tsx
client/src/pages/ProfilePage.tsx
client/src/pages/ForgotPasswordPage.tsx
client/src/pages/ResetPasswordPage.tsx
client/src/pages/ChangePasswordPage.tsx
client/src/pages/PasswordRecoveryPage.test.tsx
docs/openapi-auth-profile.json
docs/AIP-20-password-recovery.md
README.md
```

`docs/pre-push-task-audit-prompt.md` is a separate reusable workflow document and is
not part of AIP-20.

## Verification gates

Run before commit/push:

```text
npm test -- tests/password-recovery.integration.test.ts tests/auth.integration.test.ts tests/authorization.integration.test.ts tests/openapi-auth-profile.contract.test.ts
npm test
npm run build
npm --prefix client test -- PasswordRecoveryPage.test.tsx
npm --prefix client test
npm --prefix client run lint
npm --prefix client run build
git diff --check
```

## Local verification record — 2026-08-22

- Distributed atomic rate limiting with MongoDB-level reservation implemented and verified.
- Stale access token invalidation with `credentialVersion` verified across password change, reset, and lock.
- OpenAPI 3.1 auth and profile specification machine-verified by contract tests.
- High-confidence credential scan confirmed zero leaked secrets, raw tokens, or OTPs.

## Git packaging gate

The implementation is locally verified, but the current branch is
`feature/AIP-19-profile-api-ui`. Do not push AIP-20 from that branch. Create or select
the reviewed AIP-20 branch before staging, then stage only the package manifest above.
The separate untracked `docs/pre-push-task-audit-prompt.md` must not be included in the
AIP-20 commit unless a separate documentation task explicitly owns it.

The repository must use a MongoDB deployment that supports the transactions already
required by the authentication subsystem. CI, PR review, staging verification, Jira
status, and the Definition-of-Done coverage threshold remain external gates.
