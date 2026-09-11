# AIP-52 — HTTP security hardening

## Implemented behavior

AIP-52 establishes one HTTP boundary for request validation, browser-origin policy, security headers, request-size controls, and production-safe errors.

- Every request receives an `X-Request-Id`. A caller-supplied value is retained only when it is a valid UUID; otherwise the API generates one. HTTP access logs include the same ID outside the test environment.
- Browser CORS requests are allowed only when their exact origin appears in `CORS_ALLOWED_ORIGINS`. Requests without an `Origin` header continue to work for server-to-server and CLI clients.
- Production startup fails when the allowlist is empty, wildcarded, insecure, or points to a loopback host.
- Helmet supplies the standard security headers. HSTS is enabled in production and disabled in local/test environments.
- JSON and URL-encoded bodies have explicit, bounded limits. Uploads remain memory-only and capped at 5MB.
- POST, PUT, and PATCH requests with bodies must use JSON, a JSON-derived media type, URL-encoded form data, or multipart data on the JD upload endpoint.
- Route schemas validate and normalize applicable body, query, and path parameters before controllers run. Unknown fields are rejected in mutation bodies and declared query contracts.
- API errors use one envelope and include `success`, `message`, `code`, and `requestId`. Validation errors also include `errors[]` entries with `field` and `message`.
- Unexpected production 5xx responses return the generic `INTERNAL_SERVER_ERROR` contract without the original message or stack.

## Environment contract

```dotenv
CORS_ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
JSON_BODY_LIMIT=256kb
FORM_BODY_LIMIT=64kb
TRUST_PROXY_HOPS=1
```

`JSON_BODY_LIMIT` accepts 1KB through 2MB. `FORM_BODY_LIMIT` accepts 1KB through 512KB. `TRUST_PROXY_HOPS` accepts an integer from 0 through 5 and must match the number of trusted proxies in front of the application.

Local development may omit `CORS_ALLOWED_ORIGINS`; the API then allows `http://localhost:5173` and `http://127.0.0.1:5173`. Production has no fallback.

The upload boundary still accepts the repository's existing PDF, DOC, and DOCX formats. File-signature checks and any format migration belong to AIP-54.

## Error examples

Invalid input:

```json
{
  "success": false,
  "message": "Dữ liệu đầu vào không hợp lệ",
  "code": "VALIDATION_ERROR",
  "requestId": "3d6f0a9d-00b5-4c6c-8c31-8dfc76482c59",
  "errors": [
    {
      "field": "jobPosition",
      "message": "ID không đúng định dạng ObjectId"
    }
  ]
}
```

Unexpected production failure:

```json
{
  "success": false,
  "message": "Lỗi hệ thống ngoại lệ",
  "code": "INTERNAL_SERVER_ERROR",
  "requestId": "3d6f0a9d-00b5-4c6c-8c31-8dfc76482c59"
}
```

Use the response request ID to correlate a client failure with server-side logs. The current ticket does not introduce a new logging dependency; structured log transport is handled separately by the observability workstream.

## Verification

Focused AIP-52 checks:

```powershell
npx vitest run tests/http-security.integration.test.ts tests/http-env.unit.test.ts
```

Repository acceptance checks:

```powershell
npm test
npm run build
npm run lint --prefix client
npm run build --prefix client
```

The CI workflow runs deterministic `npm ci` installs, backend tests, client lint/build, and backend TypeScript compilation on pushes and pull requests targeting `main`.
