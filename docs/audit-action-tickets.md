# Audit Action Tickets

Date: 2026-04-26

## T1: Harden AI And Chat Cost Boundaries

Status: baseline implemented

Candidate files:

- `workers/api-gateway/src/routes/ai.ts`
- `workers/api-gateway/src/routes/chat.ts`
- `workers/api-gateway/src/types.ts`

Acceptance criteria:

- Paid AI generation, streaming, vision, summarization, and chat side-effect routes require an access token.
- Requests have prompt/body/message caps and backend timeout defaults.
- Worker-level rate limits are configurable through `AI_RATE_LIMIT_PER_MINUTE` and `CHAT_RATE_LIMIT_PER_MINUTE`.
- Add metrics for route, user, status, and estimated token/cost.

Follow-up:

- Replace KV counters with an atomic limiter or durable quota store.

## T2: Make Chat Uploads Private

Status: baseline implemented

Candidate files:

- `workers/api-gateway/src/routes/images.ts`
- `workers/r2-gateway/src/index.ts`

Acceptance criteria:

- New chat uploads are written outside public R2 prefixes.
- Public R2 Gateway does not serve `ai-chat/`.
- Authenticated users can read only their own private chat objects.
- Existing public `ai-chat/` objects have a migration or deletion runbook.

Follow-up:

- Add short-lived signed URLs if the frontend needs direct object rendering without API proxying.

## T3: Enforce Memo Current-Row And Version Invariants

Status: baseline implemented

Candidate files:

- `workers/api-gateway/src/routes/memos.ts`
- `workers/migrations/0035_memo_content_user_unique.sql`
- frontend memo client files

Acceptance criteria:

- `memo_content(user_id)` is unique after migration.
- Existing updates require `expectedVersion`.
- Stale writes return `409`.
- Frontend handles `409` by reloading current memo state before retrying.
- Add a concurrency integration test for two simultaneous saves.

Follow-up:

- Review archived duplicates from `memo_content_duplicate_archive_0035`.

## T4: Split Secrets Plaintext Access From Normal Admin

Status: partial baseline implemented

Candidate files:

- `workers/api-gateway/src/routes/secrets.ts`
- `workers/api-gateway/src/lib/crypto.ts`
- `workers/api-gateway/src/middleware/auth.ts`

Acceptance criteria:

- `SECRETS_ENCRYPTION_KEY` is mandatory outside development.
- Production plaintext reveal/export is disabled unless explicitly enabled.
- Production plaintext reveal/export requires a break-glass reason.
- Reveal/export audit failures fail closed.
- Add a dedicated role or scope for `secret:read_plaintext` and `secret:export`.
- Add TOTP re-auth or IAP policy for plaintext access.

Follow-up:

- Store audit events in an immutable sink outside D1.

## T5: Inventory D1 Multi-Write Paths

Status: not complete

Candidate files:

- `workers/api-gateway/src/lib/d1.ts`
- `workers/api-gateway/src/routes/comments.ts`
- `workers/api-gateway/src/routes/memories.ts`
- `workers/api-gateway/src/routes/subscribe.ts`
- `workers/api-gateway/src/routes/secrets.ts`
- `workers/api-gateway/src/lib/domain-outbox.ts`

Acceptance criteria:

- Every D1 write path with multiple statements is classified as batch, idempotent, compensating, or unsafe.
- Unsafe paths have a concrete migration task.
- The `transaction()` helper is removed or renamed after callers are inventoried.
- Fault-injection tests cover the highest-risk partial write paths.

## T6: Add Public Write Abuse Controls

Status: not complete

Candidate files:

- `workers/api-gateway/src/routes/comments.ts`
- `workers/api-gateway/src/routes/subscribe.ts`

Acceptance criteria:

- Comment and subscribe write paths use an atomic or durable rate limiter.
- Comment creation has a moderation mode or configurable pending-default option.
- Subscribe sends are abuse-limited by email and IP.
- Tests cover concurrent duplicate public writes.

## T7: Add Outbox Recovery And Alerts

Status: not complete

Candidate files:

- `workers/api-gateway/src/lib/domain-outbox.ts`
- `workers/api-gateway/src/lib/memory-embedding-outbox.ts`
- `workers/api-gateway/src/routes/admin-outbox.ts`
- `workers/api-gateway/src/index.ts`

Acceptance criteria:

- Pending age, processing age, retry count, and dead-letter count are emitted as metrics.
- Stale processing claims are reclaimed by scheduled job.
- Admin replay requires audit metadata.
- Tests cover stuck processing recovery and dead-letter alert conditions.
