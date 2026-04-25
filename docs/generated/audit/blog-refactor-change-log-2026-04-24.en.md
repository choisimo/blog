# Blog Project Refactor Change Log
- Generated: 2026-04-24 KST
- Scope: session-token security, URL-token deprecation, recovery replay prevention, internal/backend timing-safe comparisons, expiry query correction, artifact leakage prevention, tests and generated endpoint map.

# 1. Applied changes
- Added workers/migrations/0031_user_session_token_hash.sql with session_token_hash column and indexes.
- Updated workers/api-gateway/src/routes/user.ts: hashSessionToken/sessionTokenMarker, hash lookup with legacy fallback, active-only recovery, conditional deactivate, no URL-token auth, response uses presented/new token.
- Updated backend/src/routes/user.js and backend/src/adapters/session/d1-session-token-store.adapter.js with matching token-hash semantics.
- Deprecated GET /api/v1/user/session/:token and POST /api/v1/user/session/:token/recover with 410 DEPRECATED_SESSION_TOKEN_IN_URL.
- Centralized workers/api-gateway/src/routes/internal.ts auth through internal.use(*) and timing-safe hash comparison.
- Updated workers/api-gateway/src/lib/jwt.ts and workers/r2-gateway/src/index.ts to avoid direct secret/signature string equality.
- Corrected analytics/secrets expiry queries to use datetime(expires_at).
- Added .gitignore and strengthened .dockerignore to exclude .data, DB/WAL, env, evidence, and test artifacts.
- Updated workers/api-gateway/test/user-session-contract.test.ts to cover canonical verify, URL-token 410, recovery replay rejection, old token invalidation, and new token verify.
- Added docs/generated/audit/endpoint-map-full.csv, endpoint-map.json, refactor.diff, Korean markdown reports, and PDFs.

# 2. Validation performed
- node --check backend/src/routes/user.js: exit=0
- node --check backend/src/adapters/session/d1-session-token-store.adapter.js: exit=0
- node --check backend/src/routes/analytics.js: exit=0
- node --test backend/test/readiness.test.js: pass 1/1
- Full npm/vitest/typecheck not run: node_modules are absent and local Node is v18.19.0 while backend requires >=20.0.0.

# 3. Deployment order
1. Back up staging D1 and apply migration 0031.
2. Run Node20 npm ci, worker vitest/typecheck, backend tests, and route governance checks.
3. Canary Worker/backend patched release; monitor deprecated URL hits and session recover/verify failures.
4. Apply production migration and release patched code together.
5. After fallback hits approach zero, plan plaintext fallback removal/backfill.

# 4. Rollback warning
- After 0031, new sessions are hash/marker rows. Rolling back to old code can break session verification. Roll back only to a patched-code release line, not to the uploaded original semantics.

# 5. Remaining work
- Replace KV refresh/TOTP one-time state with DO/D1 transactional storage.
- Add public AI/comment/image budgets and alerts.
- Harden upload validation and streaming.
- Run full Node20 dependency-based CI.
