# Blog Project Production Audit and Refactor Report
- Source archive: blog-code-only-strict-2026-04-24.tar.gz
- Generated: 2026-04-24 KST
- Total entrypoints identified from source: 370
- Runtime distribution: {'backend': 139, 'worker-api-gateway': 223, 'r2-gateway': 3, 'seo-gateway': 2, 'terminal-gateway': 3}
- Auth distribution top values: [('public', 105), ('backend-key', 95), ('admin', 76), ('auth', 34), ('backend-key+admin', 29), ('backend-key+user', 24), ('backend-key? [custom ws validation]', 1), ('blocked-at-edge', 1), ('proxy-policy', 1), ('Cloudflare cron', 1)]
- Method distribution: [('GET', 164), ('POST', 138), ('DELETE', 32), ('PUT', 22), ('PATCH', 4), ('ALL', 3), ('USE', 1), ('Upgrade', 1), ('CRON', 1), ('GET/HEAD/OPTIONS', 1), ('GET/HEAD/PUT/DELETE', 1), ('POST/DELETE/OPTIONS', 1)]
- The Korean markdown report is included in docs/generated/audit/. This PDF is rendered with an embedded Latin font for reliable sandbox display.

# 0. Execution Summary
- What the system does: a Cloudflare Worker/Hono API gateway serves native /api/v1 routes and proxies allowed backend-owned routes to an Express backend. The backend exposes public health/readiness and protects metrics/API registry with X-Backend-Key. [Evidence: workers/api-gateway/src/index.ts | proxyToBackend/registerWorkerRoutes/scheduled | lines 36-348] [Evidence: backend/src/index.js | health/readiness/metrics/requireBackendKey | lines 85-130]
- State stores: D1/SQLite-like tables for user sessions/comments/etc., KV for OAuth/TOTP/refresh/rate state, R2 for uploads, and backend dependencies for Redis/Postgres/OpenAI/GitHub. [Evidence: workers/migrations/0018_user_fingerprints.sql] [Evidence: workers/api-gateway/src/routes/auth.ts] [Evidence: workers/api-gateway/src/routes/images.ts]
- Maturity: the project has boundary contracts and governance scripts, but route handlers still mix controller, state transition, persistence, and security concerns. KV is used for one-time auth state without strong CAS semantics. [Evidence: shared/src/contracts/service-boundaries.js] [Evidence: workers/api-gateway/src/routes/auth.ts]
- Highest risks fixed in this patch: URL-path session tokens were removed with 410 responses; raw session-token persistence was replaced by hash/marker storage; recovery replay is blocked by active-only lookup and conditional deactivate; internal/backend key comparison is timing-safe; local DB artifacts are excluded. [Evidence: refactor.diff]
- Highest risks remaining: refresh/TOTP KV races, public AI/comment/image abuse controls, upload content validation, migration sequencing, and full Node20 dependency test execution. [Evidence: auth.ts, ai.ts, comments.ts, images.ts, validation.log]
- Provisional production decision: not an unconditional production-ready release. It is suitable for staged/canary rollout only after 0031 migration, Node20 npm install, worker vitest/typecheck, backend tests, and runtime alerts are in place.

# 1. System Architecture Overview
- Topology: Client/Frontend -> Cloudflare Worker API Gateway -> {Worker-owned D1/KV/R2 routes, backend proxy with X-Backend-Key} -> Express Backend -> local DB/Redis/Postgres/OpenAI/GitHub style dependencies. Additional workers include r2-gateway, seo-gateway, and terminal-gateway. [Evidence: endpoint-map-full.csv]
- Runtime entrypoints: backend/src/index.js; workers/api-gateway/src/index.ts; workers/r2-gateway/src/index.ts; workers/seo-gateway; workers/terminal-gateway. [Evidence: endpoint map]
- Layering: Edge routes and middleware, backend Express routes, shared boundary contracts, migrations/persistence, integrations. The real architecture is hybrid, not pure clean architecture, because route modules contain business rules and SQL/KV/R2 calls.
- Primary data flows: session create/verify/recover; OAuth/TOTP/refresh; AI generation; comments/reactions/SSE; image upload/delete; backend proxy. Each flow is documented in sections 4-6.
- Auth/AuthZ: backend key protects backend API; Worker uses requireAuth/requireAdmin and injects backend key for proxy calls; internal routes now use centralized middleware. [Evidence: backend/src/index.js, workers/api-gateway/src/routes/internal.ts, workers/api-gateway/src/index.ts]
- Boundary summary: shared service-boundaries.js is valuable but must be enforced in CI to avoid route shadowing or accidental public/proxy exposure.

# 2. Evidence Ledger
Category | Path | Symbol | Claim supported | Confidence
--- | --- | --- | --- | ---
Runtime | backend/src/index.js | Express app / health / readiness / metrics / requireBackendKey | Backend exposes health/readiness publicly; metrics and registry are protected by backend key | confirmed
Runtime | workers/api-gateway/src/index.ts | Hono app / proxyToBackend / scheduled | Worker API Gateway owns native routes, backend proxy, and cron entrypoint | confirmed
Route boundary | workers/api-gateway/src/routes/registry.ts | registerWorkerRoutes | Auth, comments, AI, images, analytics, secrets, user and other Worker-owned routes are mounted under /api/v1 | confirmed
Route boundary | backend/src/routes/registry.js | registerRoutes | Backend has public notification routes and protected API mounts | confirmed
Service boundary | shared/src/contracts/service-boundaries.js | WORKER_OWNED/BACKEND_OWNED/PROXY_ONLY | The code declares worker/backend/proxy-only boundary contracts | confirmed
Session schema | workers/migrations/0018_user_fingerprints.sql | user_sessions DDL | Sessions are persisted as D1/SQLite rows with token, active flag, expiry, and indexes | confirmed
Refactor | workers/migrations/0031_user_session_token_hash.sql | session_token_hash | Adds hash column and indexes for non-plaintext session token persistence | confirmed
Refactor | workers/api-gateway/src/routes/user.ts | hashSessionToken / findActiveSessionByToken / recoverSessionByToken | Worker session create/verify/recover uses token hashing and active-only recovery | confirmed
Refactor | backend/src/routes/user.js | getActiveSessionByToken / deactivateSession | Backend mirror route uses the same hash lookup and conditional deactivate semantics | confirmed
Refactor | backend/src/adapters/session/d1-session-token-store.adapter.js | D1SessionTokenStore | Adapter returns the presented token while storing/looking up hashes | confirmed
Security | workers/api-gateway/src/routes/internal.ts | internal.use + hasValidBackendKey | Internal auth is centralized in middleware and uses timing-safe hash comparison | confirmed
Security | workers/api-gateway/src/lib/jwt.ts | constantTimeEqual | JWT HMAC comparison avoids direct string equality | confirmed
Security | workers/r2-gateway/src/index.ts | timingSafeEqual | R2 gateway internal key comparison is timing-safe | confirmed
Consistency | analytics/secrets route files | datetime(expires_at) | Expiry queries use SQLite datetime() instead of unsafe lexical comparison | confirmed
Operations | .dockerignore and .gitignore | DB/env/evidence excludes | Local DB/WAL, env files, build/test/evidence artifacts are excluded from git/build context | confirmed
Validation | validation.log | node checks / readiness test | Patched JS syntax checks passed and readiness test passed; full Node20 dependency test was not run | confirmed
Unknown | CI/CD provider | not detected | Deployment pipeline logs, production D1 schema, and secret rotation are not available in the archive | unknown

# 3. Complete Endpoint Summary Table
- Source scan identified 370 HTTP/RPC/WebSocket/Cron/Object-gateway entrypoints. The original 15-column CSV is docs/generated/audit/endpoint-map-full.csv.
- Runtime distribution: {'backend': 139, 'worker-api-gateway': 223, 'r2-gateway': 3, 'seo-gateway': 2, 'terminal-gateway': 3}
- Auth distribution: [('public', 105), ('backend-key', 95), ('admin', 76), ('auth', 34), ('backend-key+admin', 29), ('backend-key+user', 24), ('backend-key? [custom ws validation]', 1), ('blocked-at-edge', 1), ('proxy-policy', 1), ('Cloudflare cron', 1), ('X-Internal-Key', 1), ('admin JWT + Origin', 1), ('admin JWT or terminal ticket', 1)]
- Method distribution: [('GET', 164), ('POST', 138), ('DELETE', 32), ('PUT', 22), ('PATCH', 4), ('ALL', 3), ('USE', 1), ('Upgrade', 1), ('CRON', 1), ('GET/HEAD/OPTIONS', 1), ('GET/HEAD/PUT/DELETE', 1), ('POST/DELETE/OPTIONS', 1), ('GET Upgrade', 1)]
- Each block below contains the requested columns: ID, type, method/op, path/topic, handler, service/usecase, input, output, auth/authz, state change, side effects, idempotency, transaction, test, evidence.

E076 | HTTP | GET | /api/v1/healthz | Handler=app.get (index.js:85) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/index.js | app.get | line 85]
E138 | HTTP | GET | /health | Handler=app.get (index.js:91) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/index.js | app.get | line 91]
E118 | HTTP | GET | /api/v1/readiness | Handler=app.get (index.js:97) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/index.js | app.get | line 97]
E139 | HTTP | USE | /metrics | Handler=metricsRouter (index.js:115) | Service=metrics
  Input=auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/index.js | metricsRouter | line 115]
E092 | HTTP | GET | /api/v1/notifications/stream | Handler=router.get (notifications.js:127) | Service=notifications
  Input=query/header,auth-context | Output=SSE/stream Response | Auth=backend-key+user | State=No/read
  SideEffects=D1 notifications, SSE | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/notifications.service.test.js partial | [Evidence: backend/src/routes/notifications.js | router.get | line 127]
E093 | HTTP | GET | /api/v1/notifications/unread | Handler=router.get (notifications.js:152) | Service=notifications
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=D1 notifications, SSE | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/notifications.service.test.js partial | [Evidence: backend/src/routes/notifications.js | router.get | line 152]
E091 | HTTP | GET | /api/v1/notifications/history | Handler=router.get (notifications.js:181) | Service=notifications
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=D1 notifications, SSE | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/notifications.service.test.js partial | [Evidence: backend/src/routes/notifications.js | router.get | line 181]
E089 | HTTP | PATCH | /api/v1/notifications/:notificationId/read | Handler=router.patch (notifications.js:210) | Service=notifications
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1 notifications, SSE | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=backend/test/notifications.service.test.js partial | [Evidence: backend/src/routes/notifications.js | router.patch | line 210]
E090 | HTTP | GET | /api/v1/notifications/health | Handler=router.get (notifications.js:305) | Service=notifications
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=D1 notifications, SSE | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/routes/notifications.js | router.get | line 305]
E044 | HTTP | GET | /api/v1/ai/models | Handler=router.get (ai.js:135) | Service=ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.get | line 135]
E036 | HTTP | POST | /api/v1/ai/auto-chat | Handler=router.post (ai.js:264) | Service=ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.post | line 264]
E043 | HTTP | GET | /api/v1/ai/health | Handler=router.get (ai.js:336) | Service=ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/routes/ai.js | router.get | line 336]
E049 | HTTP | GET | /api/v1/ai/status | Handler=router.get (ai.js:357) | Service=ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.get | line 357]
E046 | HTTP | GET | /api/v1/ai/queue-stats | Handler=router.get (ai.js:389) | Service=ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.get | line 389]
E039 | HTTP | GET | /api/v1/ai/dlq | Handler=router.get (ai.js:417) | Service=ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.get | line 417]
E040 | HTTP | POST | /api/v1/ai/dlq/:messageId/reprocess | Handler=router.post (ai.js:438) | Service=ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.post | line 438]
E038 | HTTP | DELETE | /api/v1/ai/dlq | Handler=router.delete (ai.js:463) | Service=ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.delete | line 463]
E047 | HTTP | GET | /api/v1/ai/rate-limit | Handler=router.get (ai.js:480) | Service=ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.get | line 480]
E051 | HTTP | GET | /api/v1/ai/vision/health | Handler=router.get (ai.js:723) | Service=ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/routes/ai.js | router.get | line 723]
E050 | HTTP | POST | /api/v1/ai/summarize | Handler=router.post (ai.js:744) | Service=ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.post | line 744]
E048 | HTTP | POST | /api/v1/ai/sketch | Handler=router.post (ai.js:775) | Service=ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.post | line 775]
E045 | HTTP | POST | /api/v1/ai/prism | Handler=router.post (ai.js:805) | Service=ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.post | line 805]
E037 | HTTP | POST | /api/v1/ai/chain | Handler=router.post (ai.js:831) | Service=ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.post | line 831]
E041 | HTTP | POST | /api/v1/ai/generate | Handler=router.post (ai.js:864) | Service=ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.post | line 864]
E042 | HTTP | GET | /api/v1/ai/generate/stream | Handler=router.get (ai.js:884) | Service=ai
  Input=query/header,auth-context | Output=SSE/stream Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/ai.js | router.get | line 884]
E057 | HTTP | POST | /api/v1/analytics/view | Handler=router.post (analytics.js:39) | Service=analytics
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/analytics.js | router.post | line 39]
E055 | HTTP | GET | /api/v1/analytics/stats/:year/:slug | Handler=router.get (analytics.js:64) | Service=analytics
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/analytics.js | router.get | line 64]
E052 | HTTP | GET | /api/v1/analytics/all-stats | Handler=router.get (analytics.js:79) | Service=analytics
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/analytics.js | router.get | line 79]
E053 | HTTP | GET | /api/v1/analytics/editor-picks | Handler=router.get (analytics.js:94) | Service=analytics
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/analytics.js | router.get | line 94]
E056 | HTTP | GET | /api/v1/analytics/trending | Handler=router.get (analytics.js:113) | Service=analytics
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/analytics.js | router.get | line 113]
E054 | HTTP | POST | /api/v1/analytics/refresh-stats | Handler=router.post (analytics.js:126) | Service=analytics
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Weak: no KV CAS | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/analytics.js | router.post | line 126]
E065 | HTTP | POST | /api/v1/chat/session | Handler=router.post (chat.js:273) | Service=chat
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.post | line 273]
E066 | HTTP | POST | /api/v1/chat/session/:sessionId/message | Handler=router.post (chat.js:307) | Service=chat
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.post | line 307]
E064 | HTTP | GET | /api/v1/chat/live/stream | Handler=router.get (chat.js:452) | Service=chat
  Input=query/header,auth-context | Output=SSE/stream Response | Auth=backend-key | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.get | line 452]
E061 | HTTP | POST | /api/v1/chat/live/message | Handler=router.post (chat.js:550) | Service=chat
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.post | line 550]
E059 | HTTP | GET | /api/v1/chat/live/config | Handler=router.get (chat.js:674) | Service=chat
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.get | line 674]
E060 | HTTP | PUT | /api/v1/chat/live/config | Handler=router.put (chat.js:692) | Service=chat
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.put | line 692]
E062 | HTTP | GET | /api/v1/chat/live/room-stats | Handler=router.get (chat.js:717) | Service=chat
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.get | line 717]
E063 | HTTP | GET | /api/v1/chat/live/rooms | Handler=router.get (chat.js:740) | Service=chat
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.get | line 740]
E067 | HTTP | POST | /api/v1/chat/session/:sessionId/task | Handler=router.post (chat.js:785) | Service=chat
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.post | line 785]
E058 | HTTP | POST | /api/v1/chat/aggregate | Handler=router.post (chat.js:878) | Service=chat
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | router.post | line 878]
E101 | HTTP | GET | /api/v1/public/posts/:year/:slug/translations/:targetLang | Handler=router.get (translate.js:112) | Service=translate
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/translate.js | router.get | line 112]
E102 | HTTP | GET | /api/v1/public/posts/:year/:slug/translations/:targetLang/cache | Handler=router.get (translate.js:125) | Service=translate
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/translate.js | router.get | line 125]
E121 | HTTP | POST | /api/v1/translate | Handler=router.post (translate.js:225) | Service=translate
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/translate.js | router.post | line 225]
E123 | HTTP | GET | /api/v1/translate/:year/:slug/:targetLang | Handler=router.get (translate.js:233) | Service=translate
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/translate.js | router.get | line 233]
E124 | HTTP | GET | /api/v1/translate/:year/:slug/:targetLang/status | Handler=router.get (translate.js:246) | Service=translate
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/translate.js | router.get | line 246]
E122 | HTTP | DELETE | /api/v1/translate/:year/:slug/:targetLang | Handler=router.delete (translate.js:260) | Service=translate
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/translate.js | router.delete | line 260]
E084 | HTTP | GET | /api/v1/memos/:userId | Handler=router.get (memos.js:38) | Service=memos
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/memos.js | router.get | line 38]
E085 | HTTP | PUT | /api/v1/memos/:userId | Handler=router.put (memos.js:62) | Service=memos
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/memos.js | router.put | line 62]
E087 | HTTP | GET | /api/v1/memos/:userId/versions | Handler=router.get (memos.js:106) | Service=memos
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/memos.js | router.get | line 106]
E088 | HTTP | GET | /api/v1/memos/:userId/versions/:version | Handler=router.get (memos.js:153) | Service=memos
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/memos.js | router.get | line 153]
E086 | HTTP | POST | /api/v1/memos/:userId/restore/:version | Handler=router.post (memos.js:191) | Service=memos
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/memos.js | router.post | line 191]
E083 | HTTP | DELETE | /api/v1/memos/:userId | Handler=router.delete (memos.js:225) | Service=memos
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/memos.js | router.delete | line 225]
E129 | HTTP | GET | /api/v1/user-content/personas | Handler=router.get (userContent.js:26) | Service=user-content
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=D1(user/session/preferences) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/userContent.js | router.get | line 26]
E130 | HTTP | POST | /api/v1/user-content/personas | Handler=router.post (userContent.js:68) | Service=user-content
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/userContent.js | router.post | line 68]
E132 | HTTP | PUT | /api/v1/user-content/personas/:id | Handler=router.put (userContent.js:115) | Service=user-content
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/userContent.js | router.put | line 115]
E131 | HTTP | DELETE | /api/v1/user-content/personas/:id | Handler=router.delete (userContent.js:171) | Service=user-content
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/userContent.js | router.delete | line 171]
E125 | HTTP | GET | /api/v1/user-content/memos | Handler=router.get (userContent.js:202) | Service=user-content
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/userContent.js | router.get | line 202]
E126 | HTTP | POST | /api/v1/user-content/memos | Handler=router.post (userContent.js:245) | Service=user-content
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/userContent.js | router.post | line 245]
E128 | HTTP | PUT | /api/v1/user-content/memos/:id | Handler=router.put (userContent.js:292) | Service=user-content
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/userContent.js | router.put | line 292]
E127 | HTTP | DELETE | /api/v1/user-content/memos/:id | Handler=router.delete (userContent.js:351) | Service=user-content
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/userContent.js | router.delete | line 351]
E094 | HTTP | GET | /api/v1/og | Handler=router.get (og.js:15) | Service=og
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/og.js | router.get | line 15]
E012 | HTTP | POST | /api/v1/admin/propose-new-version | Handler=router.post (admin.js:11) | Service=admin
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/admin.js | router.post | line 11]
E002 | HTTP | POST | /api/v1/admin/archive-comments | Handler=router.post (admin.js:119) | Service=admin
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/admin.js | router.post | line 119]
E009 | HTTP | POST | /api/v1/admin/create-post-pr | Handler=router.post (admin.js:247) | Service=admin
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/admin.js | router.post | line 247]
E095 | HTTP | GET | /api/v1/posts | Handler=router.get (posts.js:214) | Service=posts
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/posts.js | router.get | line 214]
E098 | HTTP | GET | /api/v1/posts/:year/:slug | Handler=router.get (posts.js:288) | Service=posts
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/posts.js | router.get | line 288]
E096 | HTTP | POST | /api/v1/posts | Handler=router.post (posts.js:327) | Service=posts
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/posts.js | router.post | line 327]
E099 | HTTP | PUT | /api/v1/posts/:year/:slug | Handler=router.put (posts.js:371) | Service=posts
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/posts.js | router.put | line 371]
E097 | HTTP | DELETE | /api/v1/posts/:year/:slug | Handler=router.delete (posts.js:406) | Service=posts
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/posts.js | router.delete | line 406]
E100 | HTTP | POST | /api/v1/posts/regenerate-manifests | Handler=router.post (posts.js:430) | Service=posts
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/posts.js | router.post | line 430]
E077 | HTTP | GET | /api/v1/images | Handler=router.get (images.js:177) | Service=images
  Input=query/header,file/form,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=R2, D1(attachments), AI vision? | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/images.js | router.get | line 177]
E078 | HTTP | POST | /api/v1/images/chat-upload | Handler=router.post (images.js:257) | Service=images
  Input=body/header,file/form,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=R2, D1(attachments), AI vision?, Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/images.js | router.post | line 257]
E116 | HTTP | POST | /api/v1/rag/search | Handler=router.post (rag.js:314) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=external search | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.post | line 314]
E104 | HTTP | POST | /api/v1/rag/embed | Handler=router.post (rag.js:427) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.post | line 427]
E105 | HTTP | GET | /api/v1/rag/health | Handler=router.get (rag.js:443) | Service=rag
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/routes/rag.js | router.get | line 443]
E111 | HTTP | POST | /api/v1/rag/memories/upsert | Handler=router.post (rag.js:512) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.post | line 512]
E110 | HTTP | POST | /api/v1/rag/memories/search | Handler=router.post (rag.js:555) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=external search | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.post | line 555]
E108 | HTTP | DELETE | /api/v1/rag/memories/:userId/:memoryId | Handler=router.delete (rag.js:614) | Service=rag
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.delete | line 614]
E109 | HTTP | POST | /api/v1/rag/memories/batch-delete | Handler=router.post (rag.js:643) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.post | line 643]
E106 | HTTP | POST | /api/v1/rag/index | Handler=router.post (rag.js:681) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.post | line 681]
E107 | HTTP | DELETE | /api/v1/rag/index/:documentId | Handler=router.delete (rag.js:712) | Service=rag
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.delete | line 712]
E117 | HTTP | GET | /api/v1/rag/status | Handler=router.get (rag.js:741) | Service=rag
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.get | line 741]
E103 | HTTP | GET | /api/v1/rag/collections | Handler=router.get (rag.js:800) | Service=rag
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.get | line 800]
E115 | HTTP | POST | /api/v1/rag/notebook/search | Handler=router.post (rag.js:831) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=external search | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.post | line 831]
E112 | HTTP | POST | /api/v1/rag/notebook/ask | Handler=router.post (rag.js:848) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.post | line 848]
E114 | HTTP | GET | /api/v1/rag/notebook/notebooks | Handler=router.get (rag.js:865) | Service=rag
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/rag.js | router.get | line 865]
E113 | HTTP | GET | /api/v1/rag/notebook/health | Handler=router.get (rag.js:880) | Service=rag
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/routes/rag.js | router.get | line 880]
E079 | HTTP | GET | /api/v1/memories/:userId | Handler=router.get (memories.js:24) | Service=memories
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/memories.js | router.get | line 24]
E080 | HTTP | POST | /api/v1/memories/:userId | Handler=router.post (memories.js:88) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/memories.js | router.post | line 88]
E082 | HTTP | POST | /api/v1/memories/:userId/batch | Handler=router.post (memories.js:124) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/memories.js | router.post | line 124]
E081 | HTTP | DELETE | /api/v1/memories/:userId/:memoryId | Handler=router.delete (memories.js:166) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+user | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/memories.js | router.delete | line 166]
E135 | HTTP | POST | /api/v1/user/session | Handler=router.post (user.js:125) | Service=user
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=workers/api-gateway/test/user-session-contract.test.ts | [Evidence: backend/src/routes/user.js | router.post | line 125]
E137 | HTTP | GET | /api/v1/user/session/verify | Handler=router.get (user.js:257) | Service=user
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=D1(user/session/preferences) | Idempotency=Read-idempotent | Transaction=None | Test=workers/api-gateway/test/user-session-contract.test.ts | [Evidence: backend/src/routes/user.js | router.get | line 257]
E136 | HTTP | POST | /api/v1/user/session/recover | Handler=router.post (user.js:289) | Service=user
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Improved: conditional active deactivation | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=workers/api-gateway/test/user-session-contract.test.ts | [Evidence: backend/src/routes/user.js | router.post | line 289]
E133 | HTTP | GET | /api/v1/user/preferences | Handler=router.get (user.js:422) | Service=user
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=D1(user/session/preferences) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/user.js | router.get | line 422]
E134 | HTTP | PUT | /api/v1/user/preferences | Handler=router.put (user.js:458) | Service=user
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Partially guaranteed by upsert | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/user.js | router.put | line 458]
E119 | HTTP | GET | /api/v1/search/health | Handler=router.get (search.js:7) | Service=search
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=external search | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/routes/search.js | router.get | line 7]
E120 | HTTP | POST | /api/v1/search/web | Handler=router.post (search.js:13) | Service=search
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=external search | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/search.js | router.post | line 13]
E003 | HTTP | GET | /api/v1/admin/config/categories | Handler=router.get (config.js:306) | Service=admin-config
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/config.js | router.get | line 306]
E004 | HTTP | GET | /api/v1/admin/config/current | Handler=router.get (config.js:310) | Service=admin-config
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/config.js | router.get | line 310]
E008 | HTTP | POST | /api/v1/admin/config/validate | Handler=router.post (config.js:335) | Service=admin-config
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/config.js | router.post | line 335]
E005 | HTTP | POST | /api/v1/admin/config/export | Handler=router.post (config.js:384) | Service=admin-config
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/config.js | router.post | line 384]
E006 | HTTP | POST | /api/v1/admin/config/save-env | Handler=router.post (config.js:460) | Service=admin-config
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/config.js | router.post | line 460]
E007 | HTTP | GET | /api/v1/admin/config/schema | Handler=router.get (config.js:521) | Service=admin-config
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/config.js | router.get | line 521]
E020 | HTTP | GET | /api/v1/admin/workers/list | Handler=router.get (workers.js:46) | Service=admin-workers
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.get | line 46]
E022 | HTTP | GET | /api/v1/admin/workers/secrets | Handler=router.get (workers.js:77) | Service=admin-workers
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.get | line 77]
E013 | HTTP | GET | /api/v1/admin/workers/:workerId/config | Handler=router.get (workers.js:81) | Service=admin-workers
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.get | line 81]
E017 | HTTP | POST | /api/v1/admin/workers/:workerId/vars | Handler=router.post (workers.js:107) | Service=admin-workers
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.post | line 107]
E015 | HTTP | POST | /api/v1/admin/workers/:workerId/secret | Handler=router.post (workers.js:145) | Service=admin-workers
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.post | line 145]
E014 | HTTP | POST | /api/v1/admin/workers/:workerId/deploy | Handler=router.post (workers.js:173) | Service=admin-workers
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.post | line 173]
E016 | HTTP | GET | /api/v1/admin/workers/:workerId/tail | Handler=router.get (workers.js:206) | Service=admin-workers
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.get | line 206]
E018 | HTTP | GET | /api/v1/admin/workers/d1/databases | Handler=router.get (workers.js:223) | Service=admin-workers
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.get | line 223]
E019 | HTTP | GET | /api/v1/admin/workers/kv/namespaces | Handler=router.get (workers.js:233) | Service=admin-workers
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.get | line 233]
E021 | HTTP | GET | /api/v1/admin/workers/r2/buckets | Handler=router.get (workers.js:243) | Service=admin-workers
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/workers.js | router.get | line 243]
E010 | HTTP | GET | /api/v1/admin/logs | Handler=router.get (adminLogs.js:35) | Service=admin-logs
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/adminLogs.js | router.get | line 35]
E011 | HTTP | GET | /api/v1/admin/logs/stream | Handler=router.get (adminLogs.js:52) | Service=admin-logs
  Input=query/header,auth-context | Output=SSE/stream Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/adminLogs.js | router.get | line 52]
E001 | HTTP | GET | /api/v1/admin/analytics/posts | Handler=router.get (adminAnalytics.js:26) | Service=admin-analytics
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/adminAnalytics.js | router.get | line 26]
E030 | HTTP | POST | /api/v1/agent/run | Handler=router.post (agent.js:109) | Service=agent
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.post | line 109]
E034 | HTTP | POST | /api/v1/agent/stream | Handler=router.post (agent.js:176) | Service=agent
  Input=body/header,auth-context | Output=SSE/stream Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.post | line 176]
E032 | HTTP | GET | /api/v1/agent/session/:sessionId | Handler=router.get (agent.js:364) | Service=agent
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.get | line 364]
E031 | HTTP | DELETE | /api/v1/agent/session/:sessionId | Handler=router.delete (agent.js:406) | Service=agent
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.delete | line 406]
E033 | HTTP | GET | /api/v1/agent/sessions | Handler=router.get (agent.js:429) | Service=agent
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.get | line 429]
E023 | HTTP | GET | /api/v1/agent/health | Handler=router.get (agent.js:466) | Service=agent
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: backend/src/routes/agent.js | router.get | line 466]
E035 | HTTP | GET | /api/v1/agent/tools | Handler=router.get (agent.js:497) | Service=agent
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.get | line 497]
E026 | HTTP | GET | /api/v1/agent/modes | Handler=router.get (agent.js:525) | Service=agent
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.get | line 525]
E024 | HTTP | POST | /api/v1/agent/memory/extract | Handler=router.post (agent.js:541) | Service=agent
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.post | line 541]
E025 | HTTP | POST | /api/v1/agent/memory/search | Handler=router.post (agent.js:567) | Service=agent
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=external search | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.post | line 567]
E027 | HTTP | GET | /api/v1/agent/prompts | Handler=router.get (agent.js:613) | Service=agent
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.get | line 613]
E029 | HTTP | PUT | /api/v1/agent/prompts/:mode | Handler=router.put (agent.js:627) | Service=agent
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.put | line 627]
E028 | HTTP | DELETE | /api/v1/agent/prompts/:mode | Handler=router.delete (agent.js:663) | Service=agent
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key+admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/agent.js | router.delete | line 663]
E069 | HTTP | POST | /api/v1/debate/sessions | Handler=router.post (debate.js:16) | Service=debate
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/debate.js | router.post | line 16]
E071 | HTTP | POST | /api/v1/debate/sessions/:sessionId/round | Handler=router.post (debate.js:70) | Service=debate
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/debate.js | router.post | line 70]
E072 | HTTP | POST | /api/v1/debate/sessions/:sessionId/round/stream | Handler=router.post (debate.js:184) | Service=debate
  Input=params,body/header,auth-context | Output=SSE/stream Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/debate.js | router.post | line 184]
E073 | HTTP | POST | /api/v1/debate/sessions/:sessionId/vote | Handler=router.post (debate.js:314) | Service=debate
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/debate.js | router.post | line 314]
E070 | HTTP | POST | /api/v1/debate/sessions/:sessionId/end | Handler=router.post (debate.js:358) | Service=debate
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/debate.js | router.post | line 358]
E075 | HTTP | GET | /api/v1/execute/runtimes | Handler=router.get (execute.js:11) | Service=execute
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: backend/src/routes/execute.js | router.get | line 11]
E074 | HTTP | POST | /api/v1/execute | Handler=router.post (execute.js:27) | Service=execute
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/execute.js | router.post | line 27]
E068 | WebSocket | Upgrade | /api/v1/chat/ws | Handler=initChatWebSocket (chat.js:929) | Service=chat
  Input=auth-context,upgrade | Output=WebSocket stream | Auth=backend-key? [custom ws validation] | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Repository/DB scoped; explicit transactions are handler-specific | Test=Not confirmed | [Evidence: backend/src/routes/chat.js | initChatWebSocket | line 929]
E150 | HTTP | GET | /_health | Handler=app.get (index.ts:187) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/index.ts | app.get | line 187]
E367 | HTTP | GET | /healthz | Handler=app.get (index.ts:195) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/index.ts | app.get | line 195]
E366 | HTTP | GET | /health | Handler=app.get (index.ts:203) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/index.ts | app.get | line 203]
E343 | HTTP | GET | /api/v1/readiness | Handler=app.get (index.ts:207) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/index.ts | app.get | line 207]
E368 | HTTP | ALL | /metrics | Handler=app.all (index.ts:212) | Service=root
  Input=header/query | Output=JSON ApiResponse/Response | Auth=blocked-at-edge | State=No/read
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/index.ts | app.all | line 212]
E369 | HTTP | GET | /public/config | Handler=app.get (index.ts:262) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/index.ts | app.get | line 262]
E330 | HTTP | GET | /api/v1/public/config | Handler=app.get (index.ts:266) | Service=root
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/index.ts | app.get | line 266]
E148 | HTTP | ALL | * | Handler=app.all (index.ts:274) | Service=root
  Input=header/query | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/index.ts | app.all | line 274]
E149 | HTTP | ALL | * | Handler=proxyToBackend (index.ts:274) | Service=proxy-fallback
  Input=auth-context | Output=JSON ApiResponse/Response | Auth=proxy-policy | State=No/read
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/index.ts | proxyToBackend | line 274]
E237 | HTTP | POST | /api/v1/auth/oauth/handoff/consume | Handler=auth.post (auth.ts:276) | Service=auth
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.post | line 276]
E242 | HTTP | GET | /api/v1/auth/totp/status | Handler=auth.get (auth.ts:312) | Service=auth
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.get | line 312]
E240 | HTTP | GET | /api/v1/auth/totp/setup | Handler=auth.get (auth.ts:327) | Service=auth
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.get | line 327]
E241 | HTTP | POST | /api/v1/auth/totp/setup/verify | Handler=auth.post (auth.ts:378) | Service=auth
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.post | line 378]
E239 | HTTP | POST | /api/v1/auth/totp/challenge | Handler=auth.post (auth.ts:424) | Service=auth
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.post | line 424]
E243 | HTTP | POST | /api/v1/auth/totp/verify | Handler=auth.post (auth.ts:448) | Service=auth
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.post | line 448]
E233 | HTTP | GET | /api/v1/auth/oauth/github | Handler=auth.get (auth.ts:510) | Service=auth
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.get | line 510]
E234 | HTTP | GET | /api/v1/auth/oauth/github/callback | Handler=auth.get (auth.ts:540) | Service=auth
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.get | line 540]
E235 | HTTP | GET | /api/v1/auth/oauth/google | Handler=auth.get (auth.ts:620) | Service=auth
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.get | line 620]
E236 | HTTP | GET | /api/v1/auth/oauth/google/callback | Handler=auth.get (auth.ts:650) | Service=auth
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.get | line 650]
E238 | HTTP | POST | /api/v1/auth/refresh | Handler=auth.post (auth.ts:730) | Service=auth
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Weak: no KV CAS | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.post | line 730]
E231 | HTTP | POST | /api/v1/auth/logout | Handler=auth.post (auth.ts:798) | Service=auth
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.post | line 798]
E232 | HTTP | GET | /api/v1/auth/me | Handler=auth.get (auth.ts:833) | Service=auth
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.get | line 833]
E229 | HTTP | POST | /api/v1/auth/anonymous | Handler=auth.post (auth.ts:875) | Service=auth
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.post | line 875]
E230 | HTTP | POST | /api/v1/auth/anonymous/refresh | Handler=auth.post (auth.ts:924) | Service=auth
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=KV, JWT, D1(OAuth handoff) | Idempotency=Weak: no KV CAS | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/auth.ts | auth.post | line 924]
E262 | HTTP | GET | /api/v1/comments/reactions/batch | Handler=comments.get (comments.ts:176) | Service=comments
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1 comments | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/comments.ts | comments.get | line 176]
E259 | HTTP | GET | /api/v1/comments/:commentId/reactions | Handler=comments.get (comments.ts:218) | Service=comments
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1 comments | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/comments.ts | comments.get | line 218]
E260 | HTTP | POST | /api/v1/comments/:commentId/reactions | Handler=comments.post (comments.ts:257) | Service=comments
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1 comments | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/comments.ts | comments.post | line 257]
E258 | HTTP | DELETE | /api/v1/comments/:commentId/reactions | Handler=comments.delete (comments.ts:310) | Service=comments
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1 comments | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/comments.ts | comments.delete | line 310]
E256 | HTTP | GET | /api/v1/comments | Handler=comments.get (comments.ts:341) | Service=comments
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1 comments | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/comments.ts | comments.get | line 341]
E257 | HTTP | POST | /api/v1/comments | Handler=comments.post (comments.ts:365) | Service=comments
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1 comments | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/comments.ts | comments.post | line 365]
E263 | HTTP | GET | /api/v1/comments/stream | Handler=comments.get (comments.ts:460) | Service=comments
  Input=query/header | Output=SSE/stream Response | Auth=public | State=No/read
  SideEffects=D1 comments | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/comments.ts | comments.get | line 460]
E261 | HTTP | DELETE | /api/v1/comments/:id | Handler=comments.delete (comments.ts:547) | Service=comments
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=D1 comments | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/comments.ts | comments.delete | line 547]
E214 | HTTP | POST | /api/v1/ai/sketch | Handler=ai.post (ai.ts:16) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 16]
E213 | HTTP | POST | /api/v1/ai/prism | Handler=ai.post (ai.ts:34) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 34]
E209 | HTTP | POST | /api/v1/ai/chain | Handler=ai.post (ai.ts:52) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 52]
E210 | HTTP | POST | /api/v1/ai/generate | Handler=ai.post (ai.ts:74) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 74]
E211 | HTTP | GET | /api/v1/ai/generate/stream | Handler=ai.get (ai.ts:95) | Service=ai
  Input=query/header | Output=SSE/stream Response | Auth=public | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.get | line 95]
E216 | HTTP | POST | /api/v1/ai/summarize | Handler=ai.post (ai.ts:174) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 174]
E208 | HTTP | POST | /api/v1/ai/auto-chat | Handler=ai.post (ai.ts:194) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 194]
E217 | HTTP | POST | /api/v1/ai/vision/analyze | Handler=ai.post (ai.ts:221) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=backend/test/ai-vision-ssrf.test.js partial | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 221]
E212 | HTTP | GET | /api/v1/ai/health | Handler=ai.get (ai.ts:248) | Service=ai
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.get | line 248]
E215 | HTTP | GET | /api/v1/ai/status | Handler=ai.get (ai.ts:261) | Service=ai
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.get | line 261]
E206 | HTTP | POST | /api/v1/ai/artifacts/read | Handler=ai.post (ai.ts:274) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 274]
E207 | HTTP | POST | /api/v1/ai/artifacts/read/batch | Handler=ai.post (ai.ts:299) | Service=ai
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/ai.ts | ai.post | line 299]
E251 | HTTP | POST | /api/v1/chat/session | Handler=chat.post (chat.ts:37) | Service=chat
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.post | line 37]
E253 | HTTP | POST | /api/v1/chat/session/:sessionId/message | Handler=chat.post (chat.ts:41) | Service=chat
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.post | line 41]
E254 | HTTP | POST | /api/v1/chat/session/:sessionId/task | Handler=chat.post (chat.ts:48) | Service=chat
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.post | line 48]
E252 | HTTP | POST | /api/v1/chat/session/:sessionId/lens-feed | Handler=chat.post (chat.ts:55) | Service=chat
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.post | line 55]
E255 | HTTP | POST | /api/v1/chat/session/:sessionId/thought-feed | Handler=chat.post (chat.ts:155) | Service=chat
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.post | line 155]
E244 | HTTP | POST | /api/v1/chat/aggregate | Handler=chat.post (chat.ts:254) | Service=chat
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.post | line 254]
E250 | HTTP | GET | /api/v1/chat/live/stream | Handler=chat.get (chat.ts:260) | Service=chat
  Input=query/header | Output=SSE/stream Response | Auth=public | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.get | line 260]
E247 | HTTP | POST | /api/v1/chat/live/message | Handler=chat.post (chat.ts:267) | Service=chat
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.post | line 267]
E245 | HTTP | GET | /api/v1/chat/live/config | Handler=chat.get (chat.ts:273) | Service=chat
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.get | line 273]
E246 | HTTP | PUT | /api/v1/chat/live/config | Handler=chat.put (chat.ts:277) | Service=chat
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.put | line 277]
E248 | HTTP | GET | /api/v1/chat/live/room-stats | Handler=chat.get (chat.ts:281) | Service=chat
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.get | line 281]
E249 | HTTP | GET | /api/v1/chat/live/rooms | Handler=chat.get (chat.ts:286) | Service=chat
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend chat, SSE/WS, AI | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/chat.ts | chat.get | line 286]
E285 | HTTP | POST | /api/v1/images/upload | Handler=images.post (images.ts:80) | Service=images
  Input=body/header,file/form,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=R2, D1(attachments), AI vision? | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/images.ts | images.post | line 80]
E284 | HTTP | POST | /api/v1/images/presign | Handler=images.post (images.ts:88) | Service=images
  Input=body/header,file/form,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=R2, D1(attachments), AI vision? | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/images.ts | images.post | line 88]
E286 | HTTP | POST | /api/v1/images/upload-direct | Handler=images.post (images.ts:123) | Service=images
  Input=body/header,file/form,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=R2, D1(attachments), AI vision? | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/images.ts | images.post | line 123]
E283 | HTTP | POST | /api/v1/images/chat-upload | Handler=images.post (images.ts:196) | Service=images
  Input=body/header,file/form,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=R2, D1(attachments), AI vision?, Backend chat, SSE/WS, AI | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/images.ts | images.post | line 196]
E282 | HTTP | DELETE | /api/v1/images/:key | Handler=images.delete (images.ts:291) | Service=images
  Input=params,body/header,file/form,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=R2, D1(attachments), AI vision? | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/images.ts | images.delete | line 291]
E324 | HTTP | GET | /api/v1/og | Handler=og.get (og.ts:57) | Service=og
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/og.ts | og.get | line 57]
E228 | HTTP | POST | /api/v1/analytics/view | Handler=app.post (analytics.ts:66) | Service=analytics
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.post | line 66]
E225 | HTTP | GET | /api/v1/analytics/stats/:year/:slug | Handler=app.get (analytics.ts:92) | Service=analytics
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.get | line 92]
E221 | HTTP | GET | /api/v1/analytics/editor-picks | Handler=app.get (analytics.ts:128) | Service=analytics
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.get | line 128]
E226 | HTTP | GET | /api/v1/analytics/trending | Handler=app.get (analytics.ts:156) | Service=analytics
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.get | line 156]
E224 | HTTP | POST | /api/v1/analytics/refresh-stats | Handler=app.post (analytics.ts:199) | Service=analytics
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Weak: no KV CAS | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.post | line 199]
E227 | HTTP | POST | /api/v1/analytics/update-editor-picks | Handler=app.post (analytics.ts:219) | Service=analytics
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.post | line 219]
E218 | HTTP | POST | /api/v1/analytics/admin/editor-picks | Handler=app.post (analytics.ts:264) | Service=analytics
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.post | line 264]
E220 | HTTP | PUT | /api/v1/analytics/admin/editor-picks/:year/:slug | Handler=app.put (analytics.ts:323) | Service=analytics
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.put | line 323]
E219 | HTTP | DELETE | /api/v1/analytics/admin/editor-picks/:year/:slug | Handler=app.delete (analytics.ts:381) | Service=analytics
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.delete | line 381]
E222 | HTTP | POST | /api/v1/analytics/heartbeat | Handler=app.post (analytics.ts:411) | Service=analytics
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1/Postgres analytics | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.post | line 411]
E223 | HTTP | GET | /api/v1/analytics/realtime | Handler=app.get (analytics.ts:435) | Service=analytics
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/Postgres analytics | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/analytics.ts | app.get | line 435]
E331 | HTTP | GET | /api/v1/public/posts/:year/:slug/translations/:targetLang | Handler=app.get (translate.ts:537) | Service=translate
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/translate.ts | app.get | line 537]
E332 | HTTP | GET | /api/v1/public/posts/:year/:slug/translations/:targetLang/cache | Handler=app.get (translate.ts:538) | Service=translate
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/translate.ts | app.get | line 538]
E350 | HTTP | POST | /api/v1/translate | Handler=app.post (translate.ts:551) | Service=translate
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/translate.ts | app.post | line 551]
E352 | HTTP | GET | /api/v1/translate/:year/:slug/:targetLang | Handler=app.get (translate.ts:590) | Service=translate
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/translate.ts | app.get | line 590]
E353 | HTTP | GET | /api/v1/translate/:year/:slug/:targetLang/status | Handler=app.get (translate.ts:594) | Service=translate
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/translate.ts | app.get | line 594]
E351 | HTTP | DELETE | /api/v1/translate/:year/:slug/:targetLang | Handler=app.delete (translate.ts:599) | Service=translate
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/translate.ts | app.delete | line 599]
E264 | HTTP | GET | /api/v1/config | Handler=config.get (config.ts:28) | Service=config
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/config.ts | config.get | line 28]
E266 | HTTP | PUT | /api/v1/config/:key | Handler=config.put (config.ts:47) | Service=config
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/config.ts | config.put | line 47]
E265 | HTTP | DELETE | /api/v1/config/:key | Handler=config.delete (config.ts:89) | Service=config
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/config.ts | config.delete | line 89]
E267 | HTTP | POST | /api/v1/config/clear-cache | Handler=config.post (config.ts:114) | Service=config
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/config.ts | config.post | line 114]
E341 | HTTP | POST | /api/v1/rag/search | Handler=rag.post (rag.ts:84) | Service=rag
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=external search | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.post | line 84]
E334 | HTTP | POST | /api/v1/rag/embed | Handler=rag.post (rag.ts:96) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.post | line 96]
E335 | HTTP | GET | /api/v1/rag/health | Handler=rag.get (rag.ts:103) | Service=rag
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.get | line 103]
E342 | HTTP | GET | /api/v1/rag/status | Handler=rag.get (rag.ts:111) | Service=rag
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.get | line 111]
E333 | HTTP | GET | /api/v1/rag/collections | Handler=rag.get (rag.ts:118) | Service=rag
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.get | line 118]
E336 | HTTP | POST | /api/v1/rag/index | Handler=rag.post (rag.ts:125) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.post | line 125]
E337 | HTTP | DELETE | /api/v1/rag/index/:documentId | Handler=rag.delete (rag.ts:132) | Service=rag
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.delete | line 132]
E339 | HTTP | POST | /api/v1/rag/memories/search | Handler=rag.post (rag.ts:140) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=external search | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.post | line 140]
E340 | HTTP | POST | /api/v1/rag/memories/upsert | Handler=rag.post (rag.ts:144) | Service=rag
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.post | line 144]
E338 | HTTP | DELETE | /api/v1/rag/memories/:userId/:memoryId | Handler=rag.delete (rag.ts:148) | Service=rag
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/rag.ts | rag.delete | line 148]
E309 | HTTP | GET | /api/v1/memos | Handler=memos.get (memos.ts:37) | Service=memos
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.get | line 37]
E310 | HTTP | PUT | /api/v1/memos | Handler=memos.put (memos.ts:79) | Service=memos
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.put | line 79]
E318 | HTTP | GET | /api/v1/memos/versions | Handler=memos.get (memos.ts:177) | Service=memos
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.get | line 177]
E319 | HTTP | GET | /api/v1/memos/versions/:version | Handler=memos.get (memos.ts:230) | Service=memos
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.get | line 230]
E317 | HTTP | POST | /api/v1/memos/restore/:version | Handler=memos.post (memos.ts:281) | Service=memos
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.post | line 281]
E308 | HTTP | DELETE | /api/v1/memos | Handler=memos.delete (memos.ts:349) | Service=memos
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.delete | line 349]
E312 | HTTP | GET | /api/v1/memos/:userId | Handler=memos.get (memos.ts:386) | Service=memos
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.get | line 386]
E313 | HTTP | PUT | /api/v1/memos/:userId | Handler=memos.put (memos.ts:428) | Service=memos
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.put | line 428]
E315 | HTTP | GET | /api/v1/memos/:userId/versions | Handler=memos.get (memos.ts:532) | Service=memos
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.get | line 532]
E316 | HTTP | GET | /api/v1/memos/:userId/versions/:version | Handler=memos.get (memos.ts:587) | Service=memos
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.get | line 587]
E314 | HTTP | POST | /api/v1/memos/:userId/restore/:version | Handler=memos.post (memos.ts:642) | Service=memos
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.post | line 642]
E311 | HTTP | DELETE | /api/v1/memos/:userId | Handler=memos.delete (memos.ts:717) | Service=memos
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memos.ts | memos.delete | line 717]
E294 | HTTP | GET | /api/v1/memories/:userId | Handler=memories.get (memories.ts:89) | Service=memories
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.get | line 89]
E295 | HTTP | POST | /api/v1/memories/:userId | Handler=memories.post (memories.ts:158) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.post | line 158]
E299 | HTTP | POST | /api/v1/memories/:userId/batch | Handler=memories.post (memories.ts:231) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.post | line 231]
E297 | HTTP | PATCH | /api/v1/memories/:userId/:memoryId | Handler=memories.patch (memories.ts:308) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.patch | line 308]
E296 | HTTP | DELETE | /api/v1/memories/:userId/:memoryId | Handler=memories.delete (memories.ts:398) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.delete | line 398]
E298 | HTTP | POST | /api/v1/memories/:userId/access/:memoryId | Handler=memories.post (memories.ts:435) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.post | line 435]
E301 | HTTP | GET | /api/v1/memories/:userId/sessions | Handler=memories.get (memories.ts:462) | Service=memories
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.get | line 462]
E302 | HTTP | POST | /api/v1/memories/:userId/sessions | Handler=memories.post (memories.ts:508) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.post | line 508]
E304 | HTTP | GET | /api/v1/memories/:userId/sessions/:sessionId | Handler=memories.get (memories.ts:545) | Service=memories
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.get | line 545]
E306 | HTTP | POST | /api/v1/memories/:userId/sessions/:sessionId/messages | Handler=memories.post (memories.ts:602) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.post | line 602]
E307 | HTTP | POST | /api/v1/memories/:userId/sessions/:sessionId/messages/batch | Handler=memories.post (memories.ts:672) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.post | line 672]
E305 | HTTP | PATCH | /api/v1/memories/:userId/sessions/:sessionId | Handler=memories.patch (memories.ts:749) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.patch | line 749]
E303 | HTTP | DELETE | /api/v1/memories/:userId/sessions/:sessionId | Handler=memories.delete (memories.ts:798) | Service=memories
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1/R2 user state | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.delete | line 798]
E300 | HTTP | GET | /api/v1/memories/:userId/context | Handler=memories.get (memories.ts:824) | Service=memories
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=No/read
  SideEffects=D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/memories.ts | memories.get | line 824]
E168 | HTTP | GET | /api/v1/admin/ai/providers | Handler=providers.get (providers.ts:11) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.get | line 11]
E171 | HTTP | GET | /api/v1/admin/ai/providers/:id | Handler=providers.get (providers.ts:28) | Service=admin-ai
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.get | line 28]
E169 | HTTP | POST | /api/v1/admin/ai/providers | Handler=providers.post (providers.ts:58) | Service=admin-ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.post | line 58]
E172 | HTTP | PUT | /api/v1/admin/ai/providers/:id | Handler=providers.put (providers.ts:97) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.put | line 97]
E174 | HTTP | PUT | /api/v1/admin/ai/providers/:id/health | Handler=providers.put (providers.ts:147) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.put | line 147]
E175 | HTTP | POST | /api/v1/admin/ai/providers/:id/kill-switch | Handler=providers.post (providers.ts:237) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.post | line 237]
E173 | HTTP | POST | /api/v1/admin/ai/providers/:id/enable | Handler=providers.post (providers.ts:276) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.post | line 276]
E170 | HTTP | DELETE | /api/v1/admin/ai/providers/:id | Handler=providers.delete (providers.ts:305) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.delete | line 305]
E152 | HTTP | GET | /api/v1/admin/ai/models | Handler=models.get (models.ts:11) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/models.ts | models.get | line 11]
E155 | HTTP | GET | /api/v1/admin/ai/models/:id | Handler=models.get (models.ts:51) | Service=admin-ai
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/models.ts | models.get | line 51]
E153 | HTTP | POST | /api/v1/admin/ai/models | Handler=models.post (models.ts:75) | Service=admin-ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/models.ts | models.post | line 75]
E156 | HTTP | PUT | /api/v1/admin/ai/models/:id | Handler=models.put (models.ts:166) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/models.ts | models.put | line 166]
E154 | HTTP | DELETE | /api/v1/admin/ai/models/:id | Handler=models.delete (models.ts:287) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/models.ts | models.delete | line 287]
E176 | HTTP | GET | /api/v1/admin/ai/routes | Handler=routes.get (routes.ts:11) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.get | line 11]
E179 | HTTP | GET | /api/v1/admin/ai/routes/:id | Handler=routes.get (routes.ts:31) | Service=admin-ai
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.get | line 31]
E177 | HTTP | POST | /api/v1/admin/ai/routes | Handler=routes.post (routes.ts:55) | Service=admin-ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.post | line 55]
E180 | HTTP | PUT | /api/v1/admin/ai/routes/:id | Handler=routes.put (routes.ts:127) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.put | line 127]
E178 | HTTP | DELETE | /api/v1/admin/ai/routes/:id | Handler=routes.delete (routes.ts:244) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.delete | line 244]
E184 | HTTP | GET | /api/v1/admin/ai/usage | Handler=usage.get (usage.ts:11) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/usage.ts | usage.get | line 11]
E185 | HTTP | POST | /api/v1/admin/ai/usage/log | Handler=usage.post (usage.ts:101) | Service=admin-ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/usage.ts | usage.post | line 101]
E151 | HTTP | GET | /api/v1/admin/ai/config/export | Handler=config.get (config.ts:10) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/config.ts | config.get | line 10]
E157 | HTTP | GET | /api/v1/admin/ai/overview | Handler=overview.get (overview.ts:9) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/overview.ts | overview.get | line 9]
E181 | HTTP | GET | /api/v1/admin/ai/traces | Handler=traces.get (traces.ts:9) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/traces.ts | traces.get | line 9]
E182 | HTTP | GET | /api/v1/admin/ai/traces/:traceId | Handler=traces.get (traces.ts:71) | Service=admin-ai
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/traces.ts | traces.get | line 71]
E183 | HTTP | GET | /api/v1/admin/ai/traces/stats/summary | Handler=traces.get (traces.ts:101) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/traces.ts | traces.get | line 101]
E162 | HTTP | POST | /api/v1/admin/ai/playground/run | Handler=playground.post (playground.ts:12) | Service=admin-ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.post | line 12]
E159 | HTTP | GET | /api/v1/admin/ai/playground/history | Handler=playground.get (playground.ts:210) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.get | line 210]
E161 | HTTP | GET | /api/v1/admin/ai/playground/history/:id | Handler=playground.get (playground.ts:259) | Service=admin-ai
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.get | line 259]
E160 | HTTP | DELETE | /api/v1/admin/ai/playground/history/:id | Handler=playground.delete (playground.ts:276) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.delete | line 276]
E158 | HTTP | DELETE | /api/v1/admin/ai/playground/history | Handler=playground.delete (playground.ts:295) | Service=admin-ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.delete | line 295]
E163 | HTTP | GET | /api/v1/admin/ai/prompt-templates | Handler=templates.get (templates.ts:11) | Service=admin-ai
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.get | line 11]
E164 | HTTP | POST | /api/v1/admin/ai/prompt-templates | Handler=templates.post (templates.ts:37) | Service=admin-ai
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.post | line 37]
E166 | HTTP | PUT | /api/v1/admin/ai/prompt-templates/:id | Handler=templates.put (templates.ts:105) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.put | line 105]
E165 | HTTP | DELETE | /api/v1/admin/ai/prompt-templates/:id | Handler=templates.delete (templates.ts:214) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.delete | line 214]
E167 | HTTP | POST | /api/v1/admin/ai/prompt-templates/:id/use | Handler=templates.post (templates.ts:237) | Service=admin-ai
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.post | line 237]
E188 | HTTP | GET | /api/v1/admin/outbox/:stream | Handler=adminOutbox.get (admin-outbox.ts:45) | Service=admin-outbox
  Input=params,query/header,auth-context | Output=SSE/stream Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-outbox.ts | adminOutbox.get | line 45]
E191 | HTTP | POST | /api/v1/admin/outbox/:stream/replay | Handler=adminOutbox.post (admin-outbox.ts:81) | Service=admin-outbox
  Input=params,body/header,auth-context | Output=SSE/stream Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-outbox.ts | adminOutbox.post | line 81]
E189 | HTTP | POST | /api/v1/admin/outbox/:stream/ai-flush | Handler=adminOutbox.post (admin-outbox.ts:118) | Service=admin-outbox
  Input=params,body/header,auth-context | Output=SSE/stream Response | Auth=admin | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-outbox.ts | adminOutbox.post | line 118]
E190 | HTTP | POST | /api/v1/admin/outbox/:stream/flush | Handler=adminOutbox.post (admin-outbox.ts:130) | Service=admin-outbox
  Input=params,body/header,auth-context | Output=SSE/stream Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-outbox.ts | adminOutbox.post | line 130]
E199 | HTTP | GET | /api/v1/admin/secrets/categories | Handler=secrets.get (secrets.ts:109) | Service=admin-secrets
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 109]
E200 | HTTP | POST | /api/v1/admin/secrets/categories | Handler=secrets.post (secrets.ts:120) | Service=admin-secrets
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 120]
E192 | HTTP | GET | /api/v1/admin/secrets | Handler=secrets.get (secrets.ts:166) | Service=admin-secrets
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 166]
E195 | HTTP | GET | /api/v1/admin/secrets/:id | Handler=secrets.get (secrets.ts:201) | Service=admin-secrets
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 201]
E193 | HTTP | POST | /api/v1/admin/secrets | Handler=secrets.post (secrets.ts:244) | Service=admin-secrets
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 244]
E196 | HTTP | PUT | /api/v1/admin/secrets/:id | Handler=secrets.put (secrets.ts:349) | Service=admin-secrets
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.put | line 349]
E194 | HTTP | DELETE | /api/v1/admin/secrets/:id | Handler=secrets.delete (secrets.ts:490) | Service=admin-secrets
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.delete | line 490]
E197 | HTTP | POST | /api/v1/admin/secrets/:id/reveal | Handler=secrets.post (secrets.ts:535) | Service=admin-secrets
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 535]
E202 | HTTP | POST | /api/v1/admin/secrets/generate | Handler=secrets.post (secrets.ts:574) | Service=admin-secrets
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 574]
E201 | HTTP | GET | /api/v1/admin/secrets/export | Handler=secrets.get (secrets.ts:605) | Service=admin-secrets
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 605]
E204 | HTTP | POST | /api/v1/admin/secrets/import | Handler=secrets.post (secrets.ts:656) | Service=admin-secrets
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 656]
E198 | HTTP | GET | /api/v1/admin/secrets/audit | Handler=secrets.get (secrets.ts:771) | Service=admin-secrets
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 771]
E203 | HTTP | GET | /api/v1/admin/secrets/health | Handler=secrets.get (secrets.ts:835) | Service=admin-secrets
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 835]
E205 | HTTP | GET | /api/v1/admin/secrets/overview | Handler=secrets.get (secrets.ts:861) | Service=admin-secrets
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 861]
E287 | HTTP | GET | /api/v1/internal/ai-config | Handler=internal.get (internal.ts:107) | Service=internal
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/internal.ts | internal.get | line 107]
E288 | HTTP | GET | /api/v1/internal/ai-config/providers | Handler=internal.get (internal.ts:121) | Service=internal
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/internal.ts | internal.get | line 121]
E291 | HTTP | GET | /api/v1/internal/ai/resources | Handler=internal.get (internal.ts:178) | Service=internal
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/internal.ts | internal.get | line 178]
E290 | HTTP | GET | /api/v1/internal/ai/outbox/status | Handler=internal.get (internal.ts:188) | Service=internal
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=No/read
  SideEffects=Backend AI, external LLM | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/internal.ts | internal.get | line 188]
E289 | HTTP | POST | /api/v1/internal/ai/outbox/flush | Handler=internal.post (internal.ts:215) | Service=internal
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/internal.ts | internal.post | line 215]
E292 | HTTP | POST | /api/v1/internal/ai/warm | Handler=internal.post (internal.ts:229) | Service=internal
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/internal.ts | internal.post | line 229]
E293 | HTTP | POST | /api/v1/internal/ai/warm/revisit | Handler=internal.post (internal.ts:326) | Service=internal
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=backend-key | State=Yes/conditional
  SideEffects=Backend AI, external LLM | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/internal.ts | internal.post | line 326]
E325 | HTTP | GET | /api/v1/personas | Handler=personas.get (personas.ts:106) | Service=personas
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/personas.ts | personas.get | line 106]
E328 | HTTP | GET | /api/v1/personas/:id | Handler=personas.get (personas.ts:156) | Service=personas
  Input=params,query/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/personas.ts | personas.get | line 156]
E326 | HTTP | POST | /api/v1/personas | Handler=personas.post (personas.ts:186) | Service=personas
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/personas.ts | personas.post | line 186]
E329 | HTTP | PUT | /api/v1/personas/:id | Handler=personas.put (personas.ts:247) | Service=personas
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/personas.ts | personas.put | line 247]
E327 | HTTP | DELETE | /api/v1/personas/:id | Handler=personas.delete (personas.ts:318) | Service=personas
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/personas.ts | personas.delete | line 318]
E354 | HTTP | GET | /api/v1/user-content/memos | Handler=userContent.get (user-content.ts:62) | Service=user-content
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/user-content.ts | userContent.get | line 62]
E357 | HTTP | GET | /api/v1/user-content/memos/:id | Handler=userContent.get (user-content.ts:98) | Service=user-content
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/user-content.ts | userContent.get | line 98]
E355 | HTTP | POST | /api/v1/user-content/memos | Handler=userContent.post (user-content.ts:123) | Service=user-content
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/user-content.ts | userContent.post | line 123]
E358 | HTTP | PUT | /api/v1/user-content/memos/:id | Handler=userContent.put (user-content.ts:176) | Service=user-content
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/user-content.ts | userContent.put | line 176]
E356 | HTTP | DELETE | /api/v1/user-content/memos/:id | Handler=userContent.delete (user-content.ts:235) | Service=user-content
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1(user/session/preferences), D1/R2 user state | Idempotency=Partial/conditional | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/user-content.ts | userContent.delete | line 235]
E345 | HTTP | POST | /api/v1/search/web | Handler=search.post (search.ts:205) | Service=search
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=external search | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/search.ts | search.post | line 205]
E344 | HTTP | GET | /api/v1/search/health | Handler=search.get (search.ts:298) | Service=search
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=external search | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/routes/search.ts | search.get | line 298]
E361 | HTTP | POST | /api/v1/user/session | Handler=user.post (user.ts:220) | Service=user
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=workers/api-gateway/test/user-session-contract.test.ts | [Evidence: workers/api-gateway/src/routes/user.ts | user.post | line 220]
E365 | HTTP | GET | /api/v1/user/session/verify | Handler=user.get (user.ts:313) | Service=user
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1(user/session/preferences) | Idempotency=Read-idempotent | Transaction=None | Test=workers/api-gateway/test/user-session-contract.test.ts | [Evidence: workers/api-gateway/src/routes/user.ts | user.get | line 313]
E362 | HTTP | GET | /api/v1/user/session/:token | Handler=user.get (user.ts:336) | Service=user
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1(user/session/preferences) | Idempotency=Read-idempotent | Transaction=None | Test=workers/api-gateway/test/user-session-contract.test.ts | [Evidence: workers/api-gateway/src/routes/user.ts | user.get | line 336]
E364 | HTTP | POST | /api/v1/user/session/recover | Handler=user.post (user.ts:345) | Service=user
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Improved: conditional active deactivation | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=workers/api-gateway/test/user-session-contract.test.ts | [Evidence: workers/api-gateway/src/routes/user.ts | user.post | line 345]
E363 | HTTP | POST | /api/v1/user/session/:token/recover | Handler=user.post (user.ts:360) | Service=user
  Input=params,body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=workers/api-gateway/test/user-session-contract.test.ts | [Evidence: workers/api-gateway/src/routes/user.ts | user.post | line 360]
E360 | HTTP | PUT | /api/v1/user/preferences | Handler=user.put (user.ts:374) | Service=user
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=D1(user/session/preferences) | Idempotency=Partially guaranteed by upsert | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/user.ts | user.put | line 374]
E359 | HTTP | GET | /api/v1/user/preferences | Handler=user.get (user.ts:418) | Service=user
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=D1(user/session/preferences) | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/user.ts | user.get | line 418]
E269 | HTTP | POST | /api/v1/debate/sessions | Handler=debate.post (debate.ts:100) | Service=debate
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/debate.ts | debate.post | line 100]
E270 | HTTP | GET | /api/v1/debate/sessions/:id | Handler=debate.get (debate.ts:159) | Service=debate
  Input=params,query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/debate.ts | debate.get | line 159]
E272 | HTTP | POST | /api/v1/debate/sessions/:id/round | Handler=debate.post (debate.ts:228) | Service=debate
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/debate.ts | debate.post | line 228]
E273 | HTTP | POST | /api/v1/debate/sessions/:id/round/stream | Handler=debate.post (debate.ts:379) | Service=debate
  Input=params,body/header,auth-context | Output=SSE/stream Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/debate.ts | debate.post | line 379]
E274 | HTTP | POST | /api/v1/debate/sessions/:id/vote | Handler=debate.post (debate.ts:423) | Service=debate
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/debate.ts | debate.post | line 423]
E271 | HTTP | POST | /api/v1/debate/sessions/:id/end | Handler=debate.post (debate.ts:498) | Service=debate
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/debate.ts | debate.post | line 498]
E346 | HTTP | POST | /api/v1/subscribe | Handler=app.post (subscribe.ts:95) | Service=subscribe
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/subscribe.ts | app.post | line 95]
E347 | HTTP | GET | /api/v1/subscribe/confirm | Handler=app.get (subscribe.ts:172) | Service=subscribe
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/subscribe.ts | app.get | line 172]
E349 | HTTP | GET | /api/v1/subscribe/unsubscribe | Handler=app.get (subscribe.ts:207) | Service=subscribe
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/subscribe.ts | app.get | line 207]
E348 | HTTP | GET | /api/v1/subscribe/count | Handler=app.get (subscribe.ts:239) | Service=subscribe
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/subscribe.ts | app.get | line 239]
E268 | HTTP | POST | /api/v1/contact | Handler=app.post (contact.ts:14) | Service=contact
  Input=body/header | Output=JSON ApiResponse/Response | Auth=public | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/contact.ts | app.post | line 14]
E322 | HTTP | GET | /api/v1/notifications/stream | Handler=notifications.get (notifications.ts:8) | Service=notifications
  Input=query/header,auth-context | Output=SSE/stream Response | Auth=auth | State=No/read
  SideEffects=D1 notifications, SSE | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/notifications.service.test.js partial | [Evidence: workers/api-gateway/src/routes/notifications.ts | notifications.get | line 8]
E323 | HTTP | GET | /api/v1/notifications/unread | Handler=notifications.get (notifications.ts:16) | Service=notifications
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=No/read
  SideEffects=D1 notifications, SSE | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/notifications.service.test.js partial | [Evidence: workers/api-gateway/src/routes/notifications.ts | notifications.get | line 16]
E321 | HTTP | GET | /api/v1/notifications/history | Handler=notifications.get (notifications.ts:23) | Service=notifications
  Input=query/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=No/read
  SideEffects=D1 notifications, SSE | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/notifications.service.test.js partial | [Evidence: workers/api-gateway/src/routes/notifications.ts | notifications.get | line 23]
E320 | HTTP | PATCH | /api/v1/notifications/:notificationId/read | Handler=notifications.patch (notifications.ts:30) | Service=notifications
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=D1 notifications, SSE | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=backend/test/notifications.service.test.js partial | [Evidence: workers/api-gateway/src/routes/notifications.ts | notifications.patch | line 30]
E186 | HTTP | GET | /api/v1/admin/logs | Handler=adminLogs.get (admin-logs.ts:68) | Service=admin-logs
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-logs.ts | adminLogs.get | line 68]
E187 | HTTP | GET | /api/v1/admin/logs/stream | Handler=adminLogs.get (admin-logs.ts:85) | Service=admin-logs
  Input=query/header | Output=SSE/stream Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/admin-logs.ts | adminLogs.get | line 85]
E275 | HTTP | POST | /api/v1/gateway/call/auto-chat | Handler=gateway.post (gateway.ts:91) | Service=gateway
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/gateway.ts | gateway.post | line 91]
E276 | HTTP | GET | /api/v1/gateway/call/health | Handler=gateway.get (gateway.ts:105) | Service=gateway
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/routes/gateway.ts | gateway.get | line 105]
E277 | HTTP | GET | /api/v1/gateway/call/status | Handler=gateway.get (gateway.ts:117) | Service=gateway
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/gateway.ts | gateway.get | line 117]
E280 | HTTP | POST | /api/v1/gateway/vision/analyze | Handler=gateway.post (gateway.ts:228) | Service=gateway
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=auth | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/gateway.ts | gateway.post | line 228]
E281 | HTTP | GET | /api/v1/gateway/vision/health | Handler=gateway.get (gateway.ts:270) | Service=gateway
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/api-gateway/src/routes/gateway.ts | gateway.get | line 270]
E278 | HTTP | GET | /api/v1/gateway/config | Handler=gateway.get (gateway.ts:286) | Service=gateway
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=none observed/static | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/gateway.ts | gateway.get | line 286]
E279 | HTTP | PUT | /api/v1/gateway/config | Handler=gateway.put (gateway.ts:306) | Service=gateway
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin | State=Yes/conditional
  SideEffects=none observed/static | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/routes/gateway.ts | gateway.put | line 306]
E370 | ScheduledEvent | CRON | scheduled() | Handler=scheduled (index.ts:284) | Service=cron
  Input=cron-event | Output=cron side-effect only | Auth=Cloudflare cron | State=Yes
  SideEffects=D1 cleanup, outbox flush, backend refresh | Idempotency=Not guaranteed; handler-specific review required | Transaction=Mostly single D1/KV/R2 calls; multi-step atomicity limited | Test=Not confirmed | [Evidence: workers/api-gateway/src/index.ts | scheduled | line 284]
E142 | HTTP | GET/HEAD/OPTIONS | /{assets|ai-chat|images|posts|assets}/* | Handler=handleAssetRequest (index.ts:223) | Service=r2-public-assets
  Input=params,query/header,file/form | Output=object stream/headers | Auth=public | State=No/read
  SideEffects=R2 | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/r2-gateway/src/index.ts | handleAssetRequest | line 223]
E141 | HTTP | GET/HEAD/PUT/DELETE | /internal/:resource/:userId/:id? | Handler=handleInternalRequest (index.ts:234) | Service=r2-internal-json
  Input=params,body/header,auth-context | Output=JSON ApiResponse/Response | Auth=X-Internal-Key | State=Yes/conditional
  SideEffects=R2 | Idempotency=Not guaranteed; handler-specific review required | Transaction=Single runtime operation | Test=Not confirmed | [Evidence: workers/r2-gateway/src/index.ts | handleInternalRequest | line 234]
E140 | HTTP | GET | / | Handler=status (index.ts:216) | Service=r2-health
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=R2 | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/r2-gateway/src/index.ts | status | line 216]
E144 | HTTP | GET | /health | Handler=health (index.ts:133) | Service=seo-health
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=frontend/origin proxy | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/seo-gateway/src/index.ts | health | line 133]
E143 | HTTP | GET | /* | Handler=fetch/rewrite-or-proxy (index.ts:160) | Service=seo-proxy
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=frontend/origin proxy | Idempotency=Read-idempotent | Transaction=None | Test=Not confirmed | [Evidence: workers/seo-gateway/src/index.ts | fetch/rewrite-or-proxy | line 160]
E145 | HTTP | GET | /health | Handler=health (index.ts:156) | Service=terminal-health
  Input=query/header | Output=JSON ApiResponse/Response | Auth=public | State=No/read
  SideEffects=terminal origin, WebSocket | Idempotency=Read-idempotent | Transaction=None | Test=backend/test/readiness.test.js partial | [Evidence: workers/terminal-gateway/src/index.ts | health | line 156]
E146 | HTTP | POST/DELETE/OPTIONS | /session | Handler=handleSessionRequest (index.ts:162) | Service=terminal-session-ticket
  Input=body/header,auth-context | Output=JSON ApiResponse/Response | Auth=admin JWT + Origin | State=Yes/conditional
  SideEffects=terminal origin, WebSocket | Idempotency=Not guaranteed; handler-specific review required | Transaction=Single runtime operation | Test=Not confirmed | [Evidence: workers/terminal-gateway/src/index.ts | handleSessionRequest | line 162]
E147 | WebSocket | GET Upgrade | /terminal | Handler=fetch->origin websocket (index.ts:166) | Service=terminal-ws
  Input=query/header,auth-context,upgrade | Output=WebSocket stream | Auth=admin JWT or terminal ticket | State=No/read
  SideEffects=terminal origin, WebSocket | Idempotency=Not guaranteed; handler-specific review required | Transaction=Single runtime operation | Test=Not confirmed | [Evidence: workers/terminal-gateway/src/index.ts | fetch->origin websocket | line 166]

# 4. Core User Scenario E2E Traces
## Scenario A: Anonymous session create -> verify -> recover
- Endpoints: POST /api/v1/user/session, GET /api/v1/user/session/verify, POST /api/v1/user/session/recover, deprecated /session/:token routes. [Evidence: workers/api-gateway/src/routes/user.ts | lines 274-365]
Step | Input | Transformation | Output | State impact | Failure mode | Evidence
1 Receive | fingerprint/body/header | parse and normalize | session create command | none | malformed body | user.ts POST /session
2 Persist | raw session token | sha256(token) and sess_<prefix> marker | DB row with session_token_hash | INSERT user_sessions | migration/DB failure | user.ts hash/insert + 0031 migration
3 Verify | presented bearer/header token | hash lookup plus legacy plaintext fallback | session DTO with presented token | touch last_activity | missing/expired/inactive -> 404 | user.ts findActiveSessionByToken/verify
4 Recover | old active token | active-only lookup, conditional deactivate, insert new hash row | new session DTO | old inactive + new active | replay or race -> fail | user.ts recoverSessionByToken
5 Deprecated URL | path token | do not use token | 410 DEPRECATED_SESSION_TOKEN_IN_URL | no mutation | client migration required | user.ts deprecated routes
- Invariant: old token recovery must succeed at most once; raw token must not be persisted; URL must not carry the token. Patch enforces these with hash storage and active-only recovery.
- Remaining risk: deactivate and insert are not proven to be one explicit transaction; partial failure could produce old-inactive/new-missing state.

## Scenario B: OAuth/TOTP/Refresh authentication
- OAuth state/handoff, TOTP setup/challenge, refresh token family, and logout use KV get/put/delete. [Evidence: workers/api-gateway/src/routes/auth.ts | lines 156-924]
- Required invariants: OAuth state one-time use, TOTP challenge one-time use, refresh jti one-time rotation, family revoke cascade. Current KV mechanics cannot provide strong compare-and-swap; move to Durable Object or D1 transaction store.

## Scenario C: Public AI generation and artifact reads
- Endpoints include /ai/generate, /ai/generate/stream, /ai/auto-chat, /ai/vision/analyze, and artifact reads. [Evidence: workers/api-gateway/src/routes/ai.ts | lines 74-299]
- Risk is external provider cost/latency and abuse, not only DB state. Add quota, timeout, circuit breaker, model budget, and request id tracing.

## Scenario D: Comments and reactions
- Public comments/reactions and SSE stream mutate/read D1 state; admin delete exists. [Evidence: workers/api-gateway/src/routes/comments.ts | lines 176-547]
- Required invariants: duplicate reaction suppression, post ownership/identifier normalization, delete vs stream consistency, abuse limits.

## Scenario E: Image uploads and R2 state
- Admin upload/presign/upload-direct, auth chat-upload, and admin delete operate on R2 objects. [Evidence: workers/api-gateway/src/routes/images.ts | lines 80-300]
- Required invariants: admin-only blog upload, auth-only chat upload, sanitized keys, size limits, content validation, private prefix permissions, orphan cleanup.

## Scenario F: Backend proxy/internal boundary
- Worker proxy checks boundary and injects X-Backend-Key; backend requireBackendKey protects API registry. [Evidence: workers/api-gateway/src/index.ts | lines 36-179, 274-276] [Evidence: backend/src/index.js | line 117]
- Required invariants: only allowed paths proxied, no route shadowing surprises, backend-only endpoints not reachable without Worker-injected key.

# 5. Core Endpoint Deep Traces
- POST /api/v1/user/session: creates session; hashes token before persistence; no idempotency key; duplicate calls may create multiple active sessions. [Evidence: user.ts lines 35-44, 274-305]
- GET /api/v1/user/session/verify: verifies by presented token hash, legacy fallback, active flag, expiry, then touches last_activity. [Evidence: user.ts lines 91-157, 316-329]
- POST /api/v1/user/session/recover: rotates old active token into new active session; replay blocked by conditional active deactivation. [Evidence: user.ts lines 114-147, 173-213]
- GET/POST /api/v1/user/session/:token*: returns 410 and does not read token for auth. [Evidence: user.ts lines 336-365]
- POST /api/v1/auth/refresh: rotates refresh tokens using KV state; exact one-time semantics remain weak without CAS. [Evidence: auth.ts lines 730-798]
- POST /api/v1/images/upload-direct and chat-upload: writes to R2; needs streaming/content validation hardening. [Evidence: images.ts lines 123-291]
- Worker catch-all backend proxy: preserves request, injects backend key, and forwards to backend if boundary permits. [Evidence: index.ts lines 36-179]

# 6. Service State / Invariants / Transitions
- User Session Service: states are ABSENT, ACTIVE, VERIFIED, RECOVERING, REVOKED, NEW_ACTIVE. Stored in user_sessions. Invariants: no URL token, no raw token persistence, expired/inactive cannot verify, recover at most once. Patch improves all four but still needs transaction wrapping for recover update+insert. [Evidence: user.ts, backend user.js, adapter, 0031 migration]
- Auth Refresh/TOTP/OAuth Service: states are OAuth state issued/consumed, TOTP setup/challenge issued/consumed, refresh family active/revoked, refresh jti active/rotated. KV weakens temporal/retry invariants under concurrency. [Evidence: auth.ts]
- Comment/Reactions Service: states are comment/reaction rows and stream-visible history. Invariants include duplicate reaction suppression and delete/read consistency. Concurrency tests are not confirmed. [Evidence: comments.ts]
- Image/R2 Upload Service: states are R2 object existence, generated key, optional KV rate counter. Invariants include authz, key isolation, content policy, and cleanup. Magic-byte/streaming verification is not confirmed. [Evidence: images.ts]
- AI Gateway Service: state is primarily external provider cost/latency and artifact access. Invariants include bounded public cost, timeout/circuit breaker, artifact authorization. Centralized quotas are not confirmed. [Evidence: ai.ts]
- Analytics/Secrets Expiry Services: state is expires_at-based validity. Patch changes comparison to datetime(expires_at) to avoid ISO lexical errors. [Evidence: analytics/secrets changed files]
- Backend Proxy/Internal Boundary: state is env secret validity and route boundary allowlist. Patch centralizes internal route auth and timing-safe comparisons. [Evidence: internal.ts, jwt.ts, r2 index.ts]

# 7. Architecture Evaluation
- Style: hybrid edge-gateway plus modular monolith backend with shared route-boundary contracts. It is not pure clean architecture because route files own persistence/state transitions.
- Boundary collapse: session logic exists in Worker user route, backend user route, and backend adapter; this caused multi-file patching and future drift risk.
- Hidden coupling: /api/v1 namespace, shared boundary contracts, env backend keys, KV key naming, and frontend route expectations. CI must snapshot endpoints and contracts.
- Data contract risk: response DTO must return presented/new token while DB stores hash/marker. Tests now encode this contract for user sessions.
- Maintainability risk: public write endpoints are numerous; route-local validation and side effects make invariant coverage hard.

# 8. Operations / Management Evaluation
- Configuration/secrets: use Cloudflare secrets/K8s sealed secrets, forbid .data/.env artifacts, add rotation runbooks. Current code uses env keys but production rotation evidence is not available.
- Auth/security: patched session storage and timing-safe comparisons; remaining priority is auth KV state atomicity, CSRF/CORS hardening, admin scope audit, and PII-safe logs.
- Data consistency: session recovery is multi-step; add D1 transaction/batch and compensating tests. Add idempotency keys for create/payment-like side effects.
- Cache/queue/events: KV should be cache, not critical one-time state. Add replay-safe consumer contracts, DLQ/poison handling if queues exist. Queue registration was not confirmed.
- Files/streaming: add size gates, streaming upload, magic-byte validation, private prefixes/signed URLs, object lifecycle cleanup.
- Observability: health/readiness/metrics exist, but invariant metrics are not confirmed. Add request_id, deprecated URL hits, recover race, refresh replay, TOTP replay, AI cost, upload rejection, proxy 401/403/5xx alerts.
- Deployment/rollback: 0031 migration must precede or accompany patched code. Rollback to old code is unsafe for hash-only session rows; rollback to a patched-code release only.
- Scale/cost: AI generation, SSE, R2 upload, session touch writes, and backend proxy latency are hot paths. Add budgets, rate limits, connection caps, and provider/model cost metrics.

# 9. Test Gaps and Verification Plan
- Verified locally: node --check passed for patched backend JS files; backend readiness test passed. Full dependency test/typecheck was not run because node_modules are absent and local Node is v18.19.0 while backend requires >=20. [Evidence: validation.log]
- Highest priority tests: session migration/hash-only/legacy fallback; concurrent recover same old token; refresh token concurrent replay; TOTP challenge double verify; route governance snapshot for all 370 endpoints; image polyglot/oversize/path traversal; datetime expiry around timezone; public AI quota/timeout; duplicate reaction race.
- Recommended levels: unit for pure hash/expiry helpers; integration for D1/KV/R2; contract for route map and DTOs; e2e for frontend/API flows; load/chaos for AI/SSE/upload; security tests for upload/SSRF/authz.

# 10. Risk Matrix
Severity | Issue | Location | Broken invariant | Accident scenario | Detection | Fix difficulty | Recommended action | Evidence
--- | --- | --- | --- | --- | --- | --- | --- | ---
Critical | URL-path session token exposure | workers/api-gateway/src/routes/user.ts | Token must not cross URL/log boundary | Token leaks via access logs/referrers/history | Medium | Low; patched | 410 deprecation + alert | user.ts lines 336-365
Critical | Raw session token persistence | user_sessions inserts/lookups | Raw secrets must not be persisted | DB leak becomes session takeover | Hard | Medium; patched + migration | Hash/marker storage and 0031 migration | 0031 migration, user.ts hash helpers
High | Session recover partial failure | recoverSessionByToken | Recovery should be atomic | Old inactive but no new active session | Medium | Medium | D1 transaction/batch + test | user.ts lines 173-213
High | Refresh/TOTP KV race | auth.ts | One-time tokens/challenges | Concurrent replay creates duplicate auth | Hard | High | Durable Object or D1 CAS store | auth.ts KV get/delete/put
High | Public AI cost abuse | ai.ts | Public cost must be bounded | Bot traffic drives provider spend | Medium | Medium | Quota, circuit breaker, model budget | ai.ts public routes
High | Image upload validation gap | images.ts | Uploaded content must match policy | Malicious/oversized object stored | Medium | Medium | Magic-byte, streaming, private prefixes | images.ts
High | Backend proxy boundary drift | api-gateway + shared boundaries | Only allowed backend paths proxied | Admin/backend-only route accidentally exposed | Low | Medium | Route snapshot CI, deny-by-default | index.ts + boundaries
Medium | ISO datetime lexical mismatch | analytics/secrets | Expiry must be actual datetime | Expired item incorrectly active | Medium | Low; patched | datetime() tests | patched files
Medium | Local DB artifact leakage | original archive/build context | No local state in artifacts | DB/PII/secrets shipped | Easy | Low; patched | git/docker ignore + CI scan | .gitignore/.dockerignore
Medium | Weak invariant observability | metrics/logging | Violations detected quickly | Replay/abuse discovered late | Hard | Medium | Invariant metrics/alerts | health/metrics only confirmed

# 11. Concrete Improvements
## 11-A. Minimal-intrusion improvements
- Apply 0031 migration and run session contract tests: fixes raw token persistence and URL token deprecation. Validate hash-only rows, legacy fallback, replay rejection, and no-token logging.
- Add deprecated URL session endpoint metric/alert: count hits without logging token values.
- Add refresh/TOTP race tests: concurrent refresh/challenge must allow at most one success.
- Add public mutation budgets: AI, comments, and image upload need per-IP/per-user budgets and abuse alerts.
- Harden uploads: size gate, magic-byte validation, streaming, private prefixes, and orphan cleanup.
- Enforce route governance in CI: snapshot 370 endpoints and fail on unexpected public/write/proxy changes.
## 11-B. Structural improvements
- Extract UserSessionStateMachine and TokenStore: remove Worker/backend/adapter drift and centralize invariants.
- Move auth one-time state from KV to Durable Object or D1 transaction store: enforce refresh/TOTP one-time consumption.
- Introduce explicit API DTO/schema contracts: align frontend/backend/Worker serialization and validation.
- Add outbox/inbox for asynchronous side effects: replay-safe scheduled jobs and external calls.
- Build observability architecture: structured logs, request ids, invariant metrics, runbook links, no-token log tests.

# 12. Execution Priority Roadmap
- Within 24 hours: apply 0031 migration in staging; deploy 410 URL-token route; verify no .data/*.db artifacts; run Node20 npm ci + tests; add canary alerts.
- Within 1 week: add session recover concurrency test; add refresh/TOTP replay tests; add public AI/comment/image quotas; add route snapshot CI.
- Within 1-2 sprints: extract session state machine; migrate auth state store; harden uploads; add observability and runbooks.
- Structural program: redefine Worker/backend ownership, centralize DTO schemas, introduce replay-safe outbox/inbox and release safety automation.
- Runbook/alert additions: deprecated route hits, recover race, refresh replay, TOTP replay, AI cost spike, upload rejection, backend proxy auth errors, readiness degraded, D1 migration drift.

# 13. Final Decision
- Current level: significantly safer than the uploaded original for session-token handling and artifact leakage, but not fully production-ready without migration, full CI, canary, and auth state hardening.
- Production readiness: conditional canary only. Blockers are migration not applied, full Node20 tests not run, refresh/TOTP race unresolved, upload validation unconfirmed, and public AI quota unconfirmed.
- Acceptable under monitoring: legacy plaintext session fallback during migration only. Remove fallback after backfill and fallback-hit count drops to zero.
- Additional confirmation needed: real Cloudflare env/secrets, production D1 schema, CI/CD logs, wrangler deployment state, Redis/Postgres topology, frontend cache invalidation, queue/DLQ presence, external provider timeout policy.
