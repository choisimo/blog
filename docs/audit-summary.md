# Blog System Audit Summary

Date: 2026-04-26

## Scope

This document summarizes the state-transition, operations, and contract audit for the blog codebase. It is based on the Worker API Gateway, Express backend, R2 gateway, terminal gateway/server, D1/KV/R2/Postgres/Redis usage, and the route ownership contracts present in this repository.

Primary evidence:

- `workers/api-gateway/src/index.ts`
- `workers/api-gateway/src/routes/registry.ts`
- `shared/src/contracts/service-boundaries.js`
- `backend/src/index.js`
- `backend/src/routes/registry.js`
- `workers/r2-gateway/src/index.ts`
- `workers/terminal-gateway/src/index.ts`
- `backend/terminal-server/src/index.ts`

## Runtime Topology

The application is a hybrid system:

- Cloudflare Worker API Gateway owns public edge routes and selected direct write paths.
- Express Backend owns heavier origin services, protected by `X-Backend-Key`.
- R2 Gateway serves public object prefixes and internal object APIs.
- SEO Gateway handles crawler/static metadata behavior.
- Terminal Gateway and Terminal Server handle JWT admission, HMAC handoff, WebSocket, and Docker PTY runtime.
- State is distributed across D1, KV, R2, Postgres, Redis, filesystem content, and some in-memory fallback paths.

## Highest-Risk Findings

| Priority | Risk | Current mitigation in this pass | Remaining work |
| --- | --- | --- | --- |
| P0 | Public AI and chat cost abuse | Paid AI and chat routes now require access JWTs and rate limits are applied at Worker level. AI prompt/body caps and backend timeouts were added. | Replace KV counters with an atomic/quota-backed limiter; add cost metrics by route/user. |
| P0 | Public `ai-chat/` object exposure | New chat uploads now use `private/ai-chat/{userId}/...`; R2 Gateway no longer exposes `ai-chat/` as public; authenticated `GET /api/v1/images/chat-object?key=...` was added. | Migrate or expire existing `ai-chat/` objects; add signed URL TTL if the frontend needs shareable image access. |
| P0 | Memo lost update and duplicate current rows | Memo saves now require `expectedVersion` for existing rows; updates use version-checked writes; migration `0035` adds a unique user invariant. | Add frontend handling for `409`; audit production duplicates before migration. |
| P0 | Secrets plaintext reveal/export blast radius | Plaintext reveal/export is disabled in production unless `SECRET_PLAINTEXT_ACCESS_ENABLED=true`; production requires a break-glass reason; encryption now requires `SECRETS_ENCRYPTION_KEY` outside development. | Add TOTP re-auth or separate `secret:export` role; add immutable audit sink. |
| P0 | D1 transaction misunderstanding | The D1 `transaction()` helper now states it is not a real DB transaction; memo critical writes use `executeBatch` or explicit version checks. | Inventory all remaining multi-write D1 paths and add idempotency or compensation. |

## Code Changes Applied

- `workers/api-gateway/src/routes/ai.ts`: added auth, rate limit, request size caps, prompt/message caps, and default AI timeouts on paid AI endpoints.
- `workers/api-gateway/src/routes/chat.ts`: added auth and rate limits to chat write, stream, feed, and aggregate routes that can trigger backend or AI side effects.
- `workers/api-gateway/src/routes/images.ts`: moved chat upload keys to `private/ai-chat/{userId}/...` and added authenticated private object reads.
- `workers/r2-gateway/src/index.ts`: removed public serving for `ai-chat/`.
- `workers/api-gateway/src/routes/memos.ts`: added `expectedVersion` optimistic locking and batched initial memo creation.
- `workers/migrations/0035_memo_content_user_unique.sql`: archives duplicate current memo rows, consolidates versions to the newest current row, and adds a unique index on `memo_content(user_id)`.
- `workers/api-gateway/src/routes/secrets.ts`: added production break-glass gate for plaintext reveal/export.
- `workers/api-gateway/src/lib/crypto.ts`: removed JWT secret fallback outside development.
- `workers/api-gateway/src/lib/d1.ts`: clarified that `transaction()` is not a database transaction.

## Operational Runbook

Before production deploy:

1. Set `SECRETS_ENCRYPTION_KEY` as a Worker secret in all non-development environments.
2. Keep `SECRET_PLAINTEXT_ACCESS_ENABLED` unset or `false` by default.
3. Set `AI_RATE_LIMIT_PER_MINUTE` and `CHAT_RATE_LIMIT_PER_MINUTE` to explicit production values.
4. Audit existing R2 objects under `ai-chat/` and migrate, expire, or delete them.
5. Run a duplicate memo audit before applying migration `0035`.
6. Confirm frontend memo writes send `expectedVersion` from the latest read response.

High-signal alerts:

- AI or chat requests by user/IP exceed expected baseline.
- Any secret reveal/export event occurs in production.
- `memo_content` duplicate rows are detected.
- R2 contains public objects under `ai-chat/`.
- Outbox pending age or dead-letter count exceeds threshold.
- Backend readiness is degraded after migration failure.

## Residual Risks

- KV rate limits are not atomic. They are an immediate abuse reduction, not a complete quota system.
- Existing public `ai-chat/` objects remain exposed until cleaned up at the bucket level.
- Memo migration preserves duplicate rows in an archive table, but product-level conflict resolution for duplicated historical state still needs review.
- Secrets reveal/export still depends on the admin auth model; break-glass role separation and 2FA re-auth remain required.
- D1 multi-write paths outside memo routes still need a full inventory.
