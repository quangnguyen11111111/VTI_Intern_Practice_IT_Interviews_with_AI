# Security operations runbook

## Scope and ownership

This runbook covers application credentials, structured application logs, privileged taxonomy and user-status mutations, CI secret scanning, and production artifacts. The service owner coordinates incidents. Security owns incident severity and closure. Credential owners rotate only their own credential class; no credential is copied into tickets, chat, logs, test fixtures, or repository files.

| Credential | Owner and storage | Application access | Minimum privilege |
|---|---|---|---|
| Access JWT signing secret | Identity/service owner; production secret store | API process only | Sign and verify short-lived access JWTs |
| Refresh JWT signing secret | Identity/service owner; production secret store | API process only | Sign and verify refresh JWTs; distinct from access/reset secrets |
| Password-reset secret | Identity/service owner; production secret store | API process only | HMAC reset OTP/email identifiers; distinct from both JWT secrets |
| Mongo runtime credential | Database owner; production secret store | API and Agenda runtime | CRUD only on required application and Agenda collections; no user/role administration, backup, restore, or broad cluster access; production automatic index creation is disabled |
| Mongo migration/index credential | Database owner; protected migration environment | Migration/index job only | Schema and index changes for the named application database; never injected into the application process |
| SMTP credential | Messaging owner; production secret store | Mail provider component only | Send as the approved application sender; no mailbox read or tenant administration |
| Gemini credential | AI platform owner; production secret store | Gemini provider component only | Invoke approved models/project with spend and quota limits; no unrelated cloud APIs |
| Deploy SSH credential | Platform owner; protected GitHub production environment | Pinned deploy steps only | Write/restart only the named application deployment; never passed to Node, PM2 environment, build output, or application configuration |

Repository configuration contains placeholders in `.env.example` only. `.env`, `.env.*` except `.env.example`, private keys, logs, coverage, caches, and deployment archives are ignored. The Docker context and TypeScript production build exclude tests, fixtures, seeds, and debug scripts. CI installs only from lockfiles with `npm ci` and verifies the built backend and client artifacts before deployment.

## Detection and response

1. Detect. Treat a secret-scan alert, unexpected authentication failure pattern, anomalous privileged audit event, provider alert, or credential exposure report as an incident. Record the credential class, first observed time, affected environment, and safe identifiers only.
2. Isolate artifacts and logs. Stop distribution of the named artifact, prevent the affected release from advancing, and restrict access to the relevant log time window. Do not paste suspected values into reports. Preserve audit evidence and hashes. Do not delete logs, artifacts, commits, backups, or audit records during triage.
3. Revoke and rotate. Revoke the exposed credential at its authority, issue a distinct replacement, and update the owning secret store. Do not reuse a value across credential purposes or environments.
4. Restart or redeploy. Restart every process that cached the old value, or deploy the verified revision. Confirm deploy/migration credentials are absent from the application process environment.
5. Inspect anomalous access. Review authentication, provider, database, SMTP, deployment, and audit records for the exposure window. Correlate only by request ID, hashed actor ID, resource ID, timestamp, and safe event code.
6. Rerun secret scans. Scan the current working tree and the complete affected commit range. Reports must show rule and path only, with secret values fully redacted. A green scan does not replace credential revocation when a value reached history or an artifact.
7. Record the incident. Store the timeline, affected credential classes, revocation evidence, deployed revision, scan result, access-review result, and follow-up owner. Keep secret values and raw PII out of the record.

## Rotation checklists

### Access JWT, refresh JWT, and sessions

- Create separate new access and refresh signing values. Confirm neither equals the password-reset, SMTP, Mongo, Gemini, or deploy secret.
- Rotate the access secret and redeploy all API instances; existing access tokens then fail verification. Keep access lifetimes short.
- Rotate the refresh secret and invalidate all refresh-token records, or increment the applicable user/global credential version so issued refresh and access sessions cannot survive rotation.
- Confirm locked users have all refresh records revoked and their credential version incremented in the same database transaction.
- Test login, refresh, logout, locked-account denial, and expired/old token rejection. Search logs by request ID and confirm token strings are absent.

### Gemini

- Revoke the exposed key in the owning project and create a replacement limited to the approved API/project and quota.
- Update only the `GEMINI_API_KEY` secret and restart API/workers that construct the provider.
- Review model calls, usage, quota, and billing for the exposure window. Confirm provider errors and responses were not logged.

### SMTP

- Revoke or reset the SMTP application credential; preserve the approved sender identity and least-privilege send-only role.
- Update `SMTP_PASS` and, when required, `SMTP_USER`; restart mail-capable API instances.
- Review outbound-mail activity, reset-request rates, and sender reputation. Confirm OTPs, recipients, and message bodies are absent from logs.

### Mongo

- Disable the exposed database principal, create a distinct replacement with CRUD access only to required collections, and update `MONGODB_URI` in the production secret store.
- Keep migration/index credentials separate. Run index changes through the protected migration identity because production runtime automatic index creation is disabled.
- Restart API and Agenda workers, validate CRUD and queue health, and review database authentication/query audit data for anomalous access.

### Deploy credential

- Revoke the affected SSH key/token at the deployment target and protected GitHub environment, then issue a host/path-scoped replacement.
- Update only the pinned deploy action step. Confirm the value is absent from build environment variables, deployment archive, PM2 environment, and application logs.
- Review workflow runs, target-host authentication, deployed revisions, and file changes for the exposure window. Require production environment protection before the next deploy.

## Logging contract and redaction

Application logs are one JSON object per line. The only allowed fields are `timestamp`, `level`, `event`, `requestId`, `route`, `method`, `status`, `durationMs`, `actorIdHash`, `resourceType`, `resourceId`, `jobName`, and `attempt`. Events are fixed codes. Routes contain known static segments and `:parameter`; query strings and raw parameter values are excluded. Actor IDs are SHA-256 hashes.

Redaction is recursive and treats key names and value patterns as sensitive. It covers authorization, cookie and set-cookie, passwords and password hashes, tokens and refresh tokens, OTPs, secrets, API keys, SMTP passwords, email, phone, raw prompts, answers, CVs, JDs, nested errors, and credentialed URIs. Request/response objects, Error objects, environment objects, provider requests/responses, AI setup data, and generated/evaluated content are never serialized. Internal errors log a safe event and request ID; the HTTP response follows the environment-safe error contract.

Application logs are retained for 30 days and audit records for 365 days per the approved AIP-9 baseline. Changes require an approved policy update and an audited rollout; runtime cleanup must not silently remove evidence.

## Audit durability and RBAC

Authenticated Candidate, Interviewer, and Admin users may read role, level, and technology taxonomy. POST, PUT, and DELETE taxonomy routes require Admin. Admin user lock/unlock also requires Admin; Admin cannot self-lock.

Every privileged mutation writes a typed audit record containing actor ObjectId, optional target ObjectId, resource type, action, SUCCESS or FAILURE outcome, request ID, timestamp, and an optional fixed safe reason. It contains no email, token, raw body, prompt, answer, CV, JD, or provider response. A unique `(requestId, action)` index prevents duplicate audit records on retry.

The business write and SUCCESS audit write run in the same Mongo transaction. An audit write failure aborts the business write. A failed mutation writes a minimal FAILURE audit; if the audit store itself remains unavailable the endpoint returns `503 AUDIT_UNAVAILABLE`. Do not add catch-and-ignore behavior around security audit failures. Deployment must create the audit indexes with the migration/index credential before enabling these routes.

## Verification

Before release, run the focused AIP-53 tests, the complete backend test suite and build, client lint/build, the working-tree secret scan, and the production artifact verifier. Review action references for full 40-character SHAs and workflow `contents: read` permissions. Inspect the exact Git diff and confirm no `.env`, credential, raw log, coverage output, fixture, seed, debug script, or deployment credential is present in a production artifact.
