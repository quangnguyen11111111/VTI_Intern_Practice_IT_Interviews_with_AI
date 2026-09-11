# AIP-54 data protection and retention

## Scope and invariants

This policy covers Job Description (JD) uploads and extracted text, interview questions, candidate answers, AI feedback and scores, AI usage metadata, provider transport data, application logs, and security/retention audit records.

The authenticated user's database ID is the owner. Interview content is accessed through an owner-bound repository created with `forOwner(ownerId)`. Candidate and Interviewer routes use the authenticated identity; request bodies cannot supply `userId` or `ownerId`. Admin APIs expose user status, timestamps, counts, and aggregated usage only. The current Admin role has no raw JD, answer, prompt, feedback, or provider-response bypass.

Original PDF/DOCX bytes live only in Multer memory during the authenticated request. Parsing runs in an isolated worker with an empty environment, a five-second deadline, bounded memory and concurrency, then both the worker copy and request buffer references are released; the request buffer is overwritten before the controller returns. The application does not persist the filename or original file. Extracted text is normalized, stripped of contact data and tracking links, limited to 10,000 characters before persistence, and sent to AI only through the versioned prompt boundary.

Provider requests contain a fixed trusted system instruction plus bounded `UNTRUSTED_USER_CONTENT`. Provider output and mock output pass the same strict Zod and semantic validation before persistence. Agenda payloads contain only interview ID, owner ID, and a request correlation ID; workers re-read owner-scoped content from MongoDB.

## Inventory and defaults

| Data | Owner | Purpose and storage | Default retention | Purge behavior |
|---|---|---|---|---|
| Original upload bytes and filename | Candidate | Request memory only; filename is used transiently to validate extension | Request lifetime | Buffer is overwritten and reference released; never written to MongoDB, logs, jobs, or artifacts |
| Extracted JD/CV text | Candidate/session | `InterviewSession.setupData`; question context | Terminal state + 30 days | `$unset` only `setupData.jdText`, legacy `setupData.cvText`, and any legacy provider payload/response fields; summary/session survives |
| Questions, answers, feedback, evaluation and session | Candidate/session | Interview records in MongoDB | Terminal state + 365 days | Exact session and child-question deletion in a bounded transaction after approval |
| Provider transport request/response | Candidate/session | In process only | Provider call lifetime | Never persisted or logged; only bounded token counts remain |
| AI token usage and non-sensitive summary | Candidate/session | Session metadata | 365 days with session record | Removed by approved record purge |
| Application logs | Service | Operational/security investigation | 30 days | Infrastructure lifecycle policy; logs contain allowlisted, redacted fields only |
| Security and retention aggregate audit | Service/Security | Evidence of privileged and purge operations | 365 days | Separate approved audit lifecycle; never manually edited during this process |
| Backups | Database owner | Disaster recovery | Maximum 90 days, subject to approved platform policy | This job never edits backups; expired live data must not be selectively restored except during disaster recovery |

`terminalAt` is set only the first time a session enters `COMPLETED` or terminal `FAILED`. `contentPurgeAt` is `terminalAt + 30 days`; `recordPurgeAt` is `terminalAt + 365 days`. A later terminal transition preserves the original clock. TTL indexes are not used on `InterviewSession`, because content purge must preserve the parent record.

## Runtime gate and operation

Retention mutation is fail closed. `RETENTION_MUTATION_ENABLED` defaults to `false`. A mutation run also requires `RETENTION_APPROVAL_ID=POLICY-...`, referring to documented Product and Legal approval. Both conditions must be present in the validated environment. The code is not wired to an automatic scheduler in AIP-54, so deployment cannot silently start deletion.

Before enabling mutation:

1. Product and Legal approve the periods, covered data classes, notification obligations, and deletion exceptions. Record that decision under the referenced `POLICY-...` identifier without copying user content.
2. The database owner runs the migration/index plan below with the separate migration credential. Stop on sessions missing owners or duplicate question orders; do not infer ownership or delete duplicates.
3. Operations invokes bounded dry runs (maximum 100 sessions per batch), reviews eligible counts and age distribution, and configures an alert for failed batches or an unexpected count change.
4. Enable the two environment fields only in the protected production runtime and start with a small batch. Monitor aggregate `contentEligible`, `recordEligible`, `contentPurged`, and `recordsPurged` values. Audit entries contain no owner identity or content.
5. On failure, leave the gate disabled, preserve audit evidence, investigate by timestamp and safe IDs, and follow `docs/security-runbook.md`. Never repair a failed run by broad deletion.

Dry run is the default even when the gate is enabled. It uses a projection that never reads raw content. Mutation predicates include exact `_id`, `userId`, terminal status and `terminalAt`, plus the due timestamp. Content purge uses `contentPurgedAt` for idempotency. Record purge and child deletion share a Mongo transaction with aggregate audit creation; audit failure rolls back the batch.

## Migration and indexes

No production migration is executed by this change. The reviewed migration must:

1. Read-only scan for missing/invalid `userId`, invalid terminal status/timestamps, duplicate `(sessionId, order)`, and orphan questions. Report safe exact IDs to the data owner; stop on any ambiguity.
2. Add nullable/default-compatible `terminalAt`, `contentPurgeAt`, `contentPurgedAt`, and `recordPurgeAt` fields. Do not backdate terminal sessions until the approved policy defines a defensible source timestamp.
3. Build non-unique query indexes `{status:1, contentPurgeAt:1, _id:1}`, `{status:1, recordPurgeAt:1, _id:1}`, and `{userId:1, createdAt:-1}`.
4. Repeat duplicate preflight, then build unique `InterviewQuestion {sessionId:1, order:1}`. A duplicate or index-build error blocks rollout.
5. Verify the production runtime identity has CRUD only and automatic index creation is disabled. The migration credential must never enter the application environment.

The purge transaction requires a MongoDB replica set or sharded cluster. Standalone Mongo deployments may run dry-run only until transaction support is available. Rollback consists of disabling the mutation gate; do not remove fields, indexes, audit records, or restore purged content from backups as an application rollback.

## Incident handling

If raw content appears in logs, jobs, artifacts, cross-user responses, or provider context beyond the declared task, disable affected generation/evaluation and retention mutation, preserve evidence, rotate any exposed credential, identify affected owner/session IDs without copying content, and follow the detection-through-closure steps in `docs/security-runbook.md`. Notify data owners according to the approved incident policy. Confirm the fixed build with sentinel leakage, ownership, artifact, and working-tree secret scans before re-enabling it.
