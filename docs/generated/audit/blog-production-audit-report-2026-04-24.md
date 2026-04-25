# Blog 프로젝트 프로덕션 품질 시스템 감사 및 리팩토링 보고서
- 대상 압축 파일: blog-code-only-strict-2026-04-24.tar.gz
- 분석/수정 산출일: 2026-04-24 KST
- 총 식별 엔드포인트: 370개
- 런타임별 엔드포인트: {'backend': 139, 'worker-api-gateway': 223, 'r2-gateway': 3, 'seo-gateway': 2, 'terminal-gateway': 3}
- 인증 분포 상위: [('public', 105), ('backend-key', 95), ('admin', 76), ('auth', 34), ('backend-key+admin', 29), ('backend-key+user', 24), ('backend-key? [custom ws validation]', 1), ('blocked-at-edge', 1)]
- Method 분포: [('GET', 164), ('POST', 138), ('DELETE', 32), ('PUT', 22), ('PATCH', 4), ('ALL', 3), ('USE', 1), ('Upgrade', 1), ('CRON', 1), ('GET/HEAD/OPTIONS', 1), ('GET/HEAD/PUT/DELETE', 1), ('POST/DELETE/OPTIONS', 1)]
- 본 PDF에는 전체 370개 엔드포인트 row를 block-table 형태로 포함했고, 동일 내용의 15열 CSV는 docs/generated/audit/endpoint-map-full.csv에 포함했다.

# 0. 실행 요약
## 이 시스템이 실제로 하는 일
- Cloudflare Worker API Gateway가 /api/v1 아래 native Hono route(auth, comments, ai, images, analytics, secrets, user 등)를 등록하고, 일부 boundary는 Express backend로 proxy한다. [근거: workers/api-gateway/src/index.ts | app.route/proxyToBackend/scheduled | line 36-179, 270-348] [근거: workers/api-gateway/src/routes/registry.ts | registerWorkerRoutes | route mount block]
- Express backend는 health/readiness를 public으로 노출하고, metrics 및 대부분의 API registry는 X-Backend-Key로 보호한다. [근거: backend/src/index.js | app.get health/readiness, metricsRouter, app.use(requireBackendKey) | line 85-130]
- 상태 저장소는 D1/SQLite 성격의 DB(user_sessions, fingerprints, comments 등), Cloudflare KV(refresh token family, TOTP state, OAuth state), R2(images/uploads), backend local database/Redis/Postgres 연계 가능 코드로 분산되어 있다. [근거: workers/migrations/0018_user_fingerprints.sql | user_sessions DDL | line 24-43] [근거: workers/api-gateway/src/routes/auth.ts | KV put/get/delete | line 176-212, 262-268, 730-798] [근거: workers/api-gateway/src/routes/images.ts | R2 put/delete | line 80-300]

## 현재 성숙도 수준
- 아키텍처 성숙도는 “boundary contract를 가진 modular-monolith + Worker edge gateway + backend proxy 혼합” 수준이다. shared boundary contract와 route governance 스크립트가 있으나, 실제 public write route와 KV 기반 token family/TOTP state의 원자성은 아직 프로덕션 금융/계정 수준의 엄격함에 미달한다. [근거: shared/src/contracts/service-boundaries.js | service boundaries | line 1-240] [근거: package.json | routes/contracts scripts] [근거: workers/api-gateway/src/routes/auth.ts | refresh/TOTP KV state mutation | line 262-268, 730-798]
- 업로드 시점 원본에는 .data/blog.db 및 WAL/SHM 파일이 포함되어 있었고, 이는 운영/개인정보/secret leakage 관점에서 즉시 차단해야 할 품질 문제였다. 리팩토링 후 .gitignore/.dockerignore에 제외 규칙을 추가했다. [근거: 원본 압축 해제 결과 | .data/blog.db* 존재] [근거: .gitignore | DB/WAL/env exclude] [근거: .dockerignore | .data, *.db, evidence exclude]

## 가장 위험한 문제 3~5개
- Critical: 레거시 Worker 세션 endpoint가 /api/v1/user/session/:token 형태로 bearer-like token을 URL path에 받았다. URL 토큰은 access log, proxy log, browser history, referrer에 남을 수 있다. 해당 route는 410으로 폐기했다. [근거: workers/api-gateway/src/routes/user.ts | GET /session/:token, POST /session/:token/recover | line 336-365]
- High: user_sessions.session_token 평문 저장과 recovery 시 old token 재사용 가능성이 존재했다. hash 컬럼/marker 저장, active-only recovery, 조건부 deactivate로 수정했다. [근거: workers/migrations/0031_user_session_token_hash.sql | session_token_hash] [근거: workers/api-gateway/src/routes/user.ts | hashSessionToken/findRecoverableSessionByToken/deactivateSessionIfActive/recoverSessionByToken | line 35-44, 91-147, 173-213]
- High: OAuth refresh/TOTP는 KV get/delete/put 조합에 의존한다. Cloudflare KV는 강한 compare-and-swap 상태 저장소가 아니므로 동일 token/challenge 동시 소비에서 replay/race risk가 남는다. [근거: workers/api-gateway/src/routes/auth.ts | KV TOTP last step/challenge/refresh | line 262-268, 424-467, 730-798]
- High: public AI/chat/comment write route가 많고 일부는 quota/rate-limit/audit 불변식이 코드 레벨에서 충분히 중앙화되어 있지 않다. [근거: workers/api-gateway/src/routes/ai.ts | /generate,/auto-chat,/vision/analyze | line 74-248] [근거: workers/api-gateway/src/routes/comments.ts | public reactions/comments | line 176-460]
- Medium/High: ISO timestamp 문자열을 SQLite datetime(now)와 직접 비교하는 query가 있었고, T/Z 포함 timestamp에서 만료 판정 오류가 생길 수 있었다. analytics/secrets query를 datetime() 비교로 보정했다. [근거: workers/api-gateway/src/routes/analytics.ts | datetime(expires_at)] [근거: backend/src/routes/analytics.js | datetime(expires_at)] [근거: workers/api-gateway/src/routes/secrets.ts | datetime(expires_at)]

## 가장 먼저 손봐야 할 항목
- 1순위: 0031 migration을 staging/prod D1에 적용하고, hashed session token dual-read fallback이 정상 동작하는지 verify/recover contract test를 실행한다. [근거: workers/migrations/0031_user_session_token_hash.sql] [근거: workers/api-gateway/test/user-session-contract.test.ts | URL token 410/recover replay]
- 2순위: auth refresh/TOTP state를 KV에서 D1 transaction 또는 Durable Object 기반 compare-and-swap 저장소로 이전한다. [근거: workers/api-gateway/src/routes/auth.ts | KV get/delete/put mutation]
- 3순위: public AI/comment/image mutation에 per-user/per-IP budget, request id, abuse metric, invariant alert를 추가한다. [근거: endpoint-map-full.csv | public POST endpoints]

## 프로덕션 투입 가능 여부의 잠정 판정
- “현재 패치 적용본은 원본보다 안전하지만, 즉시 무조건 프로덕션 투입 가능”으로 판정하지 않는다. migration 적용, Node 20 dependency 설치 후 worker vitest/typecheck/backend full test, canary 배포, URL token endpoint 410 모니터링, refresh/TOTP race 보강 전에는 제한적/조건부 배포만 권장한다. [근거: backend/package.json | engines node >=20.0.0] [근거: validation.log | node --check pass, readiness pass, full vitest/typecheck not-run]

## 근거
- 핵심 근거는 #2 증거 레저와 docs/generated/audit/refactor.diff, endpoint-map-full.csv에 수록했다.

# 1. 시스템 아키텍처 개요
## 시스템 토폴로지
Client/Frontend -> Cloudflare Worker API Gateway(Hono) -> {Worker-owned D1/KV/R2 routes, Backend proxy via X-Backend-Key} -> Express Backend -> {local DB/Redis/Postgres/GitHub/OpenAI/notification workers}. Additional Worker services: r2-gateway, seo-gateway, terminal-gateway. [근거: workers/api-gateway/src/index.ts | proxyToBackend/registerWorkerRoutes/scheduled | line 36-348] [근거: backend/src/index.js | route registry | line 113-130]

## 런타임 진입점
- backend/src/index.js: Express app, healthz, readiness, metrics, requireBackendKey, route registry. [근거: backend/src/index.js | line 35-130]
- workers/api-gateway/src/index.ts: Hono app, public config, backend proxy, scheduled cron. [근거: workers/api-gateway/src/index.ts | line 36-348]
- workers/r2-gateway/src/index.ts: R2 object GET/PUT/DELETE style gateway. [근거: workers/r2-gateway/src/index.ts | fetch handler/isInternalCall | line 90-150]
- workers/seo-gateway와 terminal-gateway도 scanner 기준 각각 2/3개 endpoint를 가진다. [근거: docs/generated/audit/endpoint-map-full.csv | runtime=seo-gateway/terminal-gateway]

## 계층 구조
- Edge API layer: Hono route modules + middleware(requireAdmin/requireAuth, cors, security headers). [근거: workers/api-gateway/src/routes/registry.ts | route mount] [근거: workers/api-gateway/src/index.ts | middleware block | line 181-185]
- Backend API layer: Express route registry + service/adapters. [근거: backend/src/routes/registry.js | registerRoutes] [근거: backend/src/adapters/session/d1-session-token-store.adapter.js | D1 adapter]
- Shared contract layer: service-boundaries.js가 worker-owned/backend-owned/proxy-only path를 선언한다. [근거: shared/src/contracts/service-boundaries.js | boundary arrays]
- Persistence/integration layer: migrations, D1 queries, KV operations, R2 put/delete, external AI/OAuth/GitHub code. [근거: workers/migrations/*] [근거: workers/api-gateway/src/routes/auth.ts | KV/OAuth] [근거: workers/api-gateway/src/routes/images.ts | R2]

## 주요 데이터 흐름
- 세션: fingerprint/body/header -> D1 user_fingerprints/user_sessions -> response session DTO. 패치 후 DB에는 token hash와 marker가 저장되고 response에는 presented token/new token만 반환된다. [근거: workers/api-gateway/src/routes/user.ts | create/verify/recover | line 274-329, 173-213]
- Auth refresh: refresh token JWT -> KV refresh token record/family -> new access/refresh token. KV 기반 replay/race 방지가 제한적이다. [근거: workers/api-gateway/src/routes/auth.ts | refresh | line 730-798]
- Image upload: admin/auth -> multipart/R2 key -> R2 put/delete -> URL response. chat upload에는 KV rate count가 있으나 magic-byte/content scanning은 미확인이다. [근거: workers/api-gateway/src/routes/images.ts | upload/presign/upload-direct/chat-upload/delete | line 80-300]
- Backend proxy: Worker가 allowed boundary를 검사하고 X-Backend-Key를 주입해 backend에 요청을 넘긴다. [근거: workers/api-gateway/src/index.ts | proxyToBackend/canProxyPath/header injection | line 36-179]

## 주요 상태 저장소
- D1/SQLite tables: user_fingerprints, user_sessions 등. [근거: workers/migrations/0018_user_fingerprints.sql | line 1-43]
- KV: OAuth state, handoff, refresh token family, TOTP setup/challenge, rate counts. [근거: workers/api-gateway/src/routes/auth.ts | KV constants and put/get/delete] [근거: workers/api-gateway/src/routes/images.ts | rateLimitKey]
- R2: uploads, ai-chat file objects. [근거: workers/api-gateway/src/routes/images.ts | r2.put/r2.delete]
- Backend local/infra DB: original archive contained .data/blog.db; production config hints Postgres/Redis/OpenAI/GitHub dependencies. [근거: backend/package.json | dependencies] [근거: 원본 압축 해제 | .data/blog.db*]

## 인증/인가 구조
- Backend는 health/readiness 외 API를 backend key로 보호한다. [근거: backend/src/index.js | app.use(requireBackendKey) | line 117]
- Worker는 requireAuth/requireAdmin middleware로 admin/user route를 보호하고, backend proxy에는 X-Backend-Key를 주입한다. [근거: workers/api-gateway/src/routes/images.ts | requireAdmin/requireAuth | line 80-300] [근거: workers/api-gateway/src/index.ts | backend key injection]
- internal Worker route는 패치 후 internal.use 전역 미들웨어로 backend key 검증을 중앙화했다. [근거: workers/api-gateway/src/routes/internal.ts | internal.use | line 70-76]

## 외부 의존성
- Cloudflare Worker/D1/KV/R2/Wrangler, Express backend, Redis/Postgres/OpenAI/GitHub, k3s manifests. [근거: workers/api-gateway/package.json | dependencies/scripts] [근거: backend/package.json | dependencies] [근거: k3s/* | infra manifests]

## 경계 요약
- API boundary는 shared service-boundaries와 Worker registry로 어느 정도 문서화되어 있으나, Worker native route와 backend proxy가 같은 /api/v1 namespace를 공유하므로 drift가 생기면 route shadowing/proxy leak 위험이 있다. [근거: shared/src/contracts/service-boundaries.js] [근거: workers/api-gateway/src/routes/registry.ts] [근거: workers/api-gateway/src/index.ts | app.route then proxy all]

# 2. 증거 레저(Evidence Ledger)
구분 | 파일/설정/테스트/인프라 경로 | 심볼 | 이 자료가 뒷받침하는 주장 | 신뢰도
--- | --- | --- | --- | ---
런타임 진입점 | backend/src/index.js | Express app + health/readiness + metrics + requireBackendKey | Backend는 health/readiness만 public이고 metrics 및 registry 이후는 backend key 보호 | 확인됨
런타임 진입점 | workers/api-gateway/src/index.ts | Hono app + proxyToBackend + scheduled() | Worker API Gateway가 native route와 backend proxy 및 cron을 모두 담당 | 확인됨
라우팅 경계 | workers/api-gateway/src/routes/registry.ts | registerWorkerRoutes() | auth/comments/ai/images 등 Worker-owned route가 /api/v1 아래 등록됨 | 확인됨
라우팅 경계 | backend/src/routes/registry.js | registerRoutes() | Backend public notifications와 protected route mount가 분리됨 | 확인됨
서비스 경계 | shared/src/contracts/service-boundaries.js | WORKER_OWNED_BOUNDARIES/BACKEND_OWNED_BOUNDARIES | Worker/backend/proxy-only boundary 계약이 별도 shared contract로 존재 | 확인됨
세션 상태 | workers/migrations/0018_user_fingerprints.sql | user_sessions DDL | 세션은 D1 user_sessions row로 저장되고 session_token/is_active/expires_at 인덱스가 존재 | 확인됨
리팩토링 | workers/migrations/0031_user_session_token_hash.sql | session_token_hash migration | 세션 토큰 hash 컬럼과 unique/active index 추가 | 확인됨
리팩토링 | workers/api-gateway/src/routes/user.ts | hashSessionToken/findActiveSessionByToken/recoverSessionByToken | Worker 세션 발급/검증/복구가 hash lookup과 조건부 deactivate로 변경됨 | 확인됨
리팩토링 | backend/src/routes/user.js | getActiveSessionByToken/getRecoverableSessionByToken/deactivateSession | Backend mirror route도 hash lookup과 active-only recovery로 변경됨 | 확인됨
리팩토링 | backend/src/adapters/session/d1-session-token-store.adapter.js | D1SessionTokenStore | Adapter가 presented token을 응답하고 DB에는 hash/marker를 사용 | 확인됨
보안 | workers/api-gateway/src/routes/internal.ts | internal.use + hasValidBackendKey | internal route 인증이 전역 미들웨어로 중앙화되고 timing-safe hash 비교로 변경됨 | 확인됨
보안 | workers/api-gateway/src/lib/jwt.ts | constantTimeEqual | JWT HMAC signature 비교가 직접 문자열 비교에서 constant-time 비교로 변경됨 | 확인됨
보안 | workers/r2-gateway/src/index.ts | timingSafeEqual/isInternalCall | R2 gateway internal key 비교가 timing-safe 비교로 변경됨 | 확인됨
정합성 | workers/api-gateway/src/routes/analytics.ts | datetime(expires_at) | SQLite ISO-8601 T/Z와 datetime(now) 문자열 비교 mismatch를 datetime() 비교로 보정 | 확인됨
정합성 | backend/src/routes/analytics.js | datetime(expires_at) | Backend analytics session expiry query도 같은 방식으로 보정 | 확인됨
정합성 | workers/api-gateway/src/routes/secrets.ts + src/lib/secrets.ts | datetime(expires_at) | Secrets 만료/조회 비교도 datetime() 기반으로 보정 | 확인됨
운영 | .dockerignore | data/evidence/test-results exclude | 이미지 빌드 컨텍스트에서 로컬 DB와 분석 산출물 제외 규칙 추가 | 확인됨
운영 | .gitignore | DB/WAL/env/build exclude | 로컬 DB/WAL, secret/env, build cache 유출 방지 규칙 추가 | 확인됨
검증 | backend/test/readiness.test.js | node --test | readiness degraded path 1건 통과; 전체 typecheck/vitest는 dependency/node 버전 때문에 미수행 | 확인됨
미확인 | CI/CD provider | [미탐지] | 업로드 코드 내에서 실제 배포 파이프라인 실행 로그와 secret rotation 절차는 확인 불가 | 미확인

# 3. 전체 엔드포인트 요약 표
- scanner가 실제 route 등록/handler 파일을 기준으로 식별한 endpoint는 총 370개다. 문서 기반이 아니라 route source + registry를 스캔했다. [근거: docs/generated/audit/endpoint-map-full.csv]
- runtime 분포: {'backend': 139, 'worker-api-gateway': 223, 'r2-gateway': 3, 'seo-gateway': 2, 'terminal-gateway': 3}
- auth 분포: [('public', 105), ('backend-key', 95), ('admin', 76), ('auth', 34), ('backend-key+admin', 29), ('backend-key+user', 24), ('backend-key? [custom ws validation]', 1), ('blocked-at-edge', 1), ('proxy-policy', 1), ('Cloudflare cron', 1), ('X-Internal-Key', 1), ('admin JWT + Origin', 1), ('admin JWT or terminal ticket', 1)]
- method 분포: [('GET', 164), ('POST', 138), ('DELETE', 32), ('PUT', 22), ('PATCH', 4), ('ALL', 3), ('USE', 1), ('Upgrade', 1), ('CRON', 1), ('GET/HEAD/OPTIONS', 1), ('GET/HEAD/PUT/DELETE', 1), ('POST/DELETE/OPTIONS', 1), ('GET Upgrade', 1)]
- public write 후보: 47개. 우선 abuse/rate-limit/authz 검토 대상이다.
- 상태 변경 후보: 198개. transaction/idempotency/side-effect 검토 대상이다.
- 아래 block-table은 요구된 15개 열(ID, 유형, Method/Op, Path/Topic, Handler, Service/UseCase, 입력, 출력, Auth/AuthZ, 상태변경, 부수효과, 멱등성, 트랜잭션, 테스트, 근거)을 모든 endpoint에 대해 포함한다.

E076 | HTTP | GET | /api/v1/healthz | Handler=app.get (index.js:85) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/index.js | app.get | line 85]
E138 | HTTP | GET | /health | Handler=app.get (index.js:91) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/index.js | app.get | line 91]
E118 | HTTP | GET | /api/v1/readiness | Handler=app.get (index.js:97) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/index.js | app.get | line 97]
E139 | HTTP | USE | /metrics | Handler=metricsRouter (index.js:115) | Service=metrics
  입력=auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/index.js | metricsRouter | line 115]
E092 | HTTP | GET | /api/v1/notifications/stream | Handler=router.get (notifications.js:127) | Service=notifications
  입력=query/header,auth-context | 출력=SSE/stream Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1 notifications, SSE | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/notifications.service.test.js 일부 | [근거: backend/src/routes/notifications.js | router.get | line 127]
E093 | HTTP | GET | /api/v1/notifications/unread | Handler=router.get (notifications.js:152) | Service=notifications
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1 notifications, SSE | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/notifications.service.test.js 일부 | [근거: backend/src/routes/notifications.js | router.get | line 152]
E091 | HTTP | GET | /api/v1/notifications/history | Handler=router.get (notifications.js:181) | Service=notifications
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1 notifications, SSE | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/notifications.service.test.js 일부 | [근거: backend/src/routes/notifications.js | router.get | line 181]
E089 | HTTP | PATCH | /api/v1/notifications/:notificationId/read | Handler=router.patch (notifications.js:210) | Service=notifications
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1 notifications, SSE | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=backend/test/notifications.service.test.js 일부 | [근거: backend/src/routes/notifications.js | router.patch | line 210]
E090 | HTTP | GET | /api/v1/notifications/health | Handler=router.get (notifications.js:305) | Service=notifications
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=D1 notifications, SSE | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/routes/notifications.js | router.get | line 305]
E044 | HTTP | GET | /api/v1/ai/models | Handler=router.get (ai.js:135) | Service=ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.get | line 135]
E036 | HTTP | POST | /api/v1/ai/auto-chat | Handler=router.post (ai.js:264) | Service=ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.post | line 264]
E043 | HTTP | GET | /api/v1/ai/health | Handler=router.get (ai.js:336) | Service=ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/routes/ai.js | router.get | line 336]
E049 | HTTP | GET | /api/v1/ai/status | Handler=router.get (ai.js:357) | Service=ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.get | line 357]
E046 | HTTP | GET | /api/v1/ai/queue-stats | Handler=router.get (ai.js:389) | Service=ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.get | line 389]
E039 | HTTP | GET | /api/v1/ai/dlq | Handler=router.get (ai.js:417) | Service=ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.get | line 417]
E040 | HTTP | POST | /api/v1/ai/dlq/:messageId/reprocess | Handler=router.post (ai.js:438) | Service=ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.post | line 438]
E038 | HTTP | DELETE | /api/v1/ai/dlq | Handler=router.delete (ai.js:463) | Service=ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.delete | line 463]
E047 | HTTP | GET | /api/v1/ai/rate-limit | Handler=router.get (ai.js:480) | Service=ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.get | line 480]
E051 | HTTP | GET | /api/v1/ai/vision/health | Handler=router.get (ai.js:723) | Service=ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/routes/ai.js | router.get | line 723]
E050 | HTTP | POST | /api/v1/ai/summarize | Handler=router.post (ai.js:744) | Service=ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.post | line 744]
E048 | HTTP | POST | /api/v1/ai/sketch | Handler=router.post (ai.js:775) | Service=ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.post | line 775]
E045 | HTTP | POST | /api/v1/ai/prism | Handler=router.post (ai.js:805) | Service=ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.post | line 805]
E037 | HTTP | POST | /api/v1/ai/chain | Handler=router.post (ai.js:831) | Service=ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.post | line 831]
E041 | HTTP | POST | /api/v1/ai/generate | Handler=router.post (ai.js:864) | Service=ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.post | line 864]
E042 | HTTP | GET | /api/v1/ai/generate/stream | Handler=router.get (ai.js:884) | Service=ai
  입력=query/header,auth-context | 출력=SSE/stream Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/ai.js | router.get | line 884]
E057 | HTTP | POST | /api/v1/analytics/view | Handler=router.post (analytics.js:39) | Service=analytics
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/analytics.js | router.post | line 39]
E055 | HTTP | GET | /api/v1/analytics/stats/:year/:slug | Handler=router.get (analytics.js:64) | Service=analytics
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/analytics.js | router.get | line 64]
E052 | HTTP | GET | /api/v1/analytics/all-stats | Handler=router.get (analytics.js:79) | Service=analytics
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/analytics.js | router.get | line 79]
E053 | HTTP | GET | /api/v1/analytics/editor-picks | Handler=router.get (analytics.js:94) | Service=analytics
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/analytics.js | router.get | line 94]
E056 | HTTP | GET | /api/v1/analytics/trending | Handler=router.get (analytics.js:113) | Service=analytics
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/analytics.js | router.get | line 113]
E054 | HTTP | POST | /api/v1/analytics/refresh-stats | Handler=router.post (analytics.js:126) | Service=analytics
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=미흡: KV CAS 없음 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/analytics.js | router.post | line 126]
E065 | HTTP | POST | /api/v1/chat/session | Handler=router.post (chat.js:273) | Service=chat
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.post | line 273]
E066 | HTTP | POST | /api/v1/chat/session/:sessionId/message | Handler=router.post (chat.js:307) | Service=chat
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.post | line 307]
E064 | HTTP | GET | /api/v1/chat/live/stream | Handler=router.get (chat.js:452) | Service=chat
  입력=query/header,auth-context | 출력=SSE/stream Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.get | line 452]
E061 | HTTP | POST | /api/v1/chat/live/message | Handler=router.post (chat.js:550) | Service=chat
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.post | line 550]
E059 | HTTP | GET | /api/v1/chat/live/config | Handler=router.get (chat.js:674) | Service=chat
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.get | line 674]
E060 | HTTP | PUT | /api/v1/chat/live/config | Handler=router.put (chat.js:692) | Service=chat
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.put | line 692]
E062 | HTTP | GET | /api/v1/chat/live/room-stats | Handler=router.get (chat.js:717) | Service=chat
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.get | line 717]
E063 | HTTP | GET | /api/v1/chat/live/rooms | Handler=router.get (chat.js:740) | Service=chat
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.get | line 740]
E067 | HTTP | POST | /api/v1/chat/session/:sessionId/task | Handler=router.post (chat.js:785) | Service=chat
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.post | line 785]
E058 | HTTP | POST | /api/v1/chat/aggregate | Handler=router.post (chat.js:878) | Service=chat
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/chat.js | router.post | line 878]
E101 | HTTP | GET | /api/v1/public/posts/:year/:slug/translations/:targetLang | Handler=router.get (translate.js:112) | Service=translate
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/translate.js | router.get | line 112]
E102 | HTTP | GET | /api/v1/public/posts/:year/:slug/translations/:targetLang/cache | Handler=router.get (translate.js:125) | Service=translate
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/translate.js | router.get | line 125]
E121 | HTTP | POST | /api/v1/translate | Handler=router.post (translate.js:225) | Service=translate
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/translate.js | router.post | line 225]
E123 | HTTP | GET | /api/v1/translate/:year/:slug/:targetLang | Handler=router.get (translate.js:233) | Service=translate
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/translate.js | router.get | line 233]
E124 | HTTP | GET | /api/v1/translate/:year/:slug/:targetLang/status | Handler=router.get (translate.js:246) | Service=translate
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/translate.js | router.get | line 246]
E122 | HTTP | DELETE | /api/v1/translate/:year/:slug/:targetLang | Handler=router.delete (translate.js:260) | Service=translate
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/translate.js | router.delete | line 260]
E084 | HTTP | GET | /api/v1/memos/:userId | Handler=router.get (memos.js:38) | Service=memos
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/memos.js | router.get | line 38]
E085 | HTTP | PUT | /api/v1/memos/:userId | Handler=router.put (memos.js:62) | Service=memos
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/memos.js | router.put | line 62]
E087 | HTTP | GET | /api/v1/memos/:userId/versions | Handler=router.get (memos.js:106) | Service=memos
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/memos.js | router.get | line 106]
E088 | HTTP | GET | /api/v1/memos/:userId/versions/:version | Handler=router.get (memos.js:153) | Service=memos
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/memos.js | router.get | line 153]
E086 | HTTP | POST | /api/v1/memos/:userId/restore/:version | Handler=router.post (memos.js:191) | Service=memos
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/memos.js | router.post | line 191]
E083 | HTTP | DELETE | /api/v1/memos/:userId | Handler=router.delete (memos.js:225) | Service=memos
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/memos.js | router.delete | line 225]
E129 | HTTP | GET | /api/v1/user-content/personas | Handler=router.get (userContent.js:26) | Service=user-content
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/userContent.js | router.get | line 26]
E130 | HTTP | POST | /api/v1/user-content/personas | Handler=router.post (userContent.js:68) | Service=user-content
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/userContent.js | router.post | line 68]
E132 | HTTP | PUT | /api/v1/user-content/personas/:id | Handler=router.put (userContent.js:115) | Service=user-content
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/userContent.js | router.put | line 115]
E131 | HTTP | DELETE | /api/v1/user-content/personas/:id | Handler=router.delete (userContent.js:171) | Service=user-content
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/userContent.js | router.delete | line 171]
E125 | HTTP | GET | /api/v1/user-content/memos | Handler=router.get (userContent.js:202) | Service=user-content
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/userContent.js | router.get | line 202]
E126 | HTTP | POST | /api/v1/user-content/memos | Handler=router.post (userContent.js:245) | Service=user-content
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/userContent.js | router.post | line 245]
E128 | HTTP | PUT | /api/v1/user-content/memos/:id | Handler=router.put (userContent.js:292) | Service=user-content
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/userContent.js | router.put | line 292]
E127 | HTTP | DELETE | /api/v1/user-content/memos/:id | Handler=router.delete (userContent.js:351) | Service=user-content
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/userContent.js | router.delete | line 351]
E094 | HTTP | GET | /api/v1/og | Handler=router.get (og.js:15) | Service=og
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/og.js | router.get | line 15]
E012 | HTTP | POST | /api/v1/admin/propose-new-version | Handler=router.post (admin.js:11) | Service=admin
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/admin.js | router.post | line 11]
E002 | HTTP | POST | /api/v1/admin/archive-comments | Handler=router.post (admin.js:119) | Service=admin
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/admin.js | router.post | line 119]
E009 | HTTP | POST | /api/v1/admin/create-post-pr | Handler=router.post (admin.js:247) | Service=admin
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/admin.js | router.post | line 247]
E095 | HTTP | GET | /api/v1/posts | Handler=router.get (posts.js:214) | Service=posts
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/posts.js | router.get | line 214]
E098 | HTTP | GET | /api/v1/posts/:year/:slug | Handler=router.get (posts.js:288) | Service=posts
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/posts.js | router.get | line 288]
E096 | HTTP | POST | /api/v1/posts | Handler=router.post (posts.js:327) | Service=posts
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/posts.js | router.post | line 327]
E099 | HTTP | PUT | /api/v1/posts/:year/:slug | Handler=router.put (posts.js:371) | Service=posts
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/posts.js | router.put | line 371]
E097 | HTTP | DELETE | /api/v1/posts/:year/:slug | Handler=router.delete (posts.js:406) | Service=posts
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/posts.js | router.delete | line 406]
E100 | HTTP | POST | /api/v1/posts/regenerate-manifests | Handler=router.post (posts.js:430) | Service=posts
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/posts.js | router.post | line 430]
E077 | HTTP | GET | /api/v1/images | Handler=router.get (images.js:177) | Service=images
  입력=query/header,file/form,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=R2, D1(attachments), AI vision? | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/images.js | router.get | line 177]
E078 | HTTP | POST | /api/v1/images/chat-upload | Handler=router.post (images.js:257) | Service=images
  입력=body/header,file/form,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=R2, D1(attachments), AI vision?, Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/images.js | router.post | line 257]
E116 | HTTP | POST | /api/v1/rag/search | Handler=router.post (rag.js:314) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=external search | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.post | line 314]
E104 | HTTP | POST | /api/v1/rag/embed | Handler=router.post (rag.js:427) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.post | line 427]
E105 | HTTP | GET | /api/v1/rag/health | Handler=router.get (rag.js:443) | Service=rag
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/routes/rag.js | router.get | line 443]
E111 | HTTP | POST | /api/v1/rag/memories/upsert | Handler=router.post (rag.js:512) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.post | line 512]
E110 | HTTP | POST | /api/v1/rag/memories/search | Handler=router.post (rag.js:555) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=external search | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.post | line 555]
E108 | HTTP | DELETE | /api/v1/rag/memories/:userId/:memoryId | Handler=router.delete (rag.js:614) | Service=rag
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.delete | line 614]
E109 | HTTP | POST | /api/v1/rag/memories/batch-delete | Handler=router.post (rag.js:643) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.post | line 643]
E106 | HTTP | POST | /api/v1/rag/index | Handler=router.post (rag.js:681) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.post | line 681]
E107 | HTTP | DELETE | /api/v1/rag/index/:documentId | Handler=router.delete (rag.js:712) | Service=rag
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.delete | line 712]
E117 | HTTP | GET | /api/v1/rag/status | Handler=router.get (rag.js:741) | Service=rag
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.get | line 741]
E103 | HTTP | GET | /api/v1/rag/collections | Handler=router.get (rag.js:800) | Service=rag
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.get | line 800]
E115 | HTTP | POST | /api/v1/rag/notebook/search | Handler=router.post (rag.js:831) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=external search | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.post | line 831]
E112 | HTTP | POST | /api/v1/rag/notebook/ask | Handler=router.post (rag.js:848) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.post | line 848]
E114 | HTTP | GET | /api/v1/rag/notebook/notebooks | Handler=router.get (rag.js:865) | Service=rag
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/rag.js | router.get | line 865]
E113 | HTTP | GET | /api/v1/rag/notebook/health | Handler=router.get (rag.js:880) | Service=rag
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/routes/rag.js | router.get | line 880]
E079 | HTTP | GET | /api/v1/memories/:userId | Handler=router.get (memories.js:24) | Service=memories
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/memories.js | router.get | line 24]
E080 | HTTP | POST | /api/v1/memories/:userId | Handler=router.post (memories.js:88) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/memories.js | router.post | line 88]
E082 | HTTP | POST | /api/v1/memories/:userId/batch | Handler=router.post (memories.js:124) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/memories.js | router.post | line 124]
E081 | HTTP | DELETE | /api/v1/memories/:userId/:memoryId | Handler=router.delete (memories.js:166) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+user | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/memories.js | router.delete | line 166]
E135 | HTTP | POST | /api/v1/user/session | Handler=router.post (user.js:125) | Service=user
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=workers/api-gateway/test/user-session-contract.test.ts | [근거: backend/src/routes/user.js | router.post | line 125]
E137 | HTTP | GET | /api/v1/user/session/verify | Handler=router.get (user.js:257) | Service=user
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=workers/api-gateway/test/user-session-contract.test.ts | [근거: backend/src/routes/user.js | router.get | line 257]
E136 | HTTP | POST | /api/v1/user/session/recover | Handler=router.post (user.js:289) | Service=user
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=보강됨: active 조건부 비활성화 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=workers/api-gateway/test/user-session-contract.test.ts | [근거: backend/src/routes/user.js | router.post | line 289]
E133 | HTTP | GET | /api/v1/user/preferences | Handler=router.get (user.js:422) | Service=user
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/user.js | router.get | line 422]
E134 | HTTP | PUT | /api/v1/user/preferences | Handler=router.put (user.js:458) | Service=user
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=upsert 기반 부분 보장 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/user.js | router.put | line 458]
E119 | HTTP | GET | /api/v1/search/health | Handler=router.get (search.js:7) | Service=search
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=external search | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/routes/search.js | router.get | line 7]
E120 | HTTP | POST | /api/v1/search/web | Handler=router.post (search.js:13) | Service=search
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=external search | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/search.js | router.post | line 13]
E003 | HTTP | GET | /api/v1/admin/config/categories | Handler=router.get (config.js:306) | Service=admin-config
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/config.js | router.get | line 306]
E004 | HTTP | GET | /api/v1/admin/config/current | Handler=router.get (config.js:310) | Service=admin-config
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/config.js | router.get | line 310]
E008 | HTTP | POST | /api/v1/admin/config/validate | Handler=router.post (config.js:335) | Service=admin-config
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/config.js | router.post | line 335]
E005 | HTTP | POST | /api/v1/admin/config/export | Handler=router.post (config.js:384) | Service=admin-config
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/config.js | router.post | line 384]
E006 | HTTP | POST | /api/v1/admin/config/save-env | Handler=router.post (config.js:460) | Service=admin-config
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/config.js | router.post | line 460]
E007 | HTTP | GET | /api/v1/admin/config/schema | Handler=router.get (config.js:521) | Service=admin-config
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/config.js | router.get | line 521]
E020 | HTTP | GET | /api/v1/admin/workers/list | Handler=router.get (workers.js:46) | Service=admin-workers
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.get | line 46]
E022 | HTTP | GET | /api/v1/admin/workers/secrets | Handler=router.get (workers.js:77) | Service=admin-workers
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.get | line 77]
E013 | HTTP | GET | /api/v1/admin/workers/:workerId/config | Handler=router.get (workers.js:81) | Service=admin-workers
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.get | line 81]
E017 | HTTP | POST | /api/v1/admin/workers/:workerId/vars | Handler=router.post (workers.js:107) | Service=admin-workers
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.post | line 107]
E015 | HTTP | POST | /api/v1/admin/workers/:workerId/secret | Handler=router.post (workers.js:145) | Service=admin-workers
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.post | line 145]
E014 | HTTP | POST | /api/v1/admin/workers/:workerId/deploy | Handler=router.post (workers.js:173) | Service=admin-workers
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.post | line 173]
E016 | HTTP | GET | /api/v1/admin/workers/:workerId/tail | Handler=router.get (workers.js:206) | Service=admin-workers
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.get | line 206]
E018 | HTTP | GET | /api/v1/admin/workers/d1/databases | Handler=router.get (workers.js:223) | Service=admin-workers
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.get | line 223]
E019 | HTTP | GET | /api/v1/admin/workers/kv/namespaces | Handler=router.get (workers.js:233) | Service=admin-workers
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.get | line 233]
E021 | HTTP | GET | /api/v1/admin/workers/r2/buckets | Handler=router.get (workers.js:243) | Service=admin-workers
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/workers.js | router.get | line 243]
E010 | HTTP | GET | /api/v1/admin/logs | Handler=router.get (adminLogs.js:35) | Service=admin-logs
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/adminLogs.js | router.get | line 35]
E011 | HTTP | GET | /api/v1/admin/logs/stream | Handler=router.get (adminLogs.js:52) | Service=admin-logs
  입력=query/header,auth-context | 출력=SSE/stream Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/adminLogs.js | router.get | line 52]
E001 | HTTP | GET | /api/v1/admin/analytics/posts | Handler=router.get (adminAnalytics.js:26) | Service=admin-analytics
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/adminAnalytics.js | router.get | line 26]
E030 | HTTP | POST | /api/v1/agent/run | Handler=router.post (agent.js:109) | Service=agent
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.post | line 109]
E034 | HTTP | POST | /api/v1/agent/stream | Handler=router.post (agent.js:176) | Service=agent
  입력=body/header,auth-context | 출력=SSE/stream Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.post | line 176]
E032 | HTTP | GET | /api/v1/agent/session/:sessionId | Handler=router.get (agent.js:364) | Service=agent
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.get | line 364]
E031 | HTTP | DELETE | /api/v1/agent/session/:sessionId | Handler=router.delete (agent.js:406) | Service=agent
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.delete | line 406]
E033 | HTTP | GET | /api/v1/agent/sessions | Handler=router.get (agent.js:429) | Service=agent
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.get | line 429]
E023 | HTTP | GET | /api/v1/agent/health | Handler=router.get (agent.js:466) | Service=agent
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: backend/src/routes/agent.js | router.get | line 466]
E035 | HTTP | GET | /api/v1/agent/tools | Handler=router.get (agent.js:497) | Service=agent
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.get | line 497]
E026 | HTTP | GET | /api/v1/agent/modes | Handler=router.get (agent.js:525) | Service=agent
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.get | line 525]
E024 | HTTP | POST | /api/v1/agent/memory/extract | Handler=router.post (agent.js:541) | Service=agent
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.post | line 541]
E025 | HTTP | POST | /api/v1/agent/memory/search | Handler=router.post (agent.js:567) | Service=agent
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=external search | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.post | line 567]
E027 | HTTP | GET | /api/v1/agent/prompts | Handler=router.get (agent.js:613) | Service=agent
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.get | line 613]
E029 | HTTP | PUT | /api/v1/agent/prompts/:mode | Handler=router.put (agent.js:627) | Service=agent
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.put | line 627]
E028 | HTTP | DELETE | /api/v1/agent/prompts/:mode | Handler=router.delete (agent.js:663) | Service=agent
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key+admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/agent.js | router.delete | line 663]
E069 | HTTP | POST | /api/v1/debate/sessions | Handler=router.post (debate.js:16) | Service=debate
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/debate.js | router.post | line 16]
E071 | HTTP | POST | /api/v1/debate/sessions/:sessionId/round | Handler=router.post (debate.js:70) | Service=debate
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/debate.js | router.post | line 70]
E072 | HTTP | POST | /api/v1/debate/sessions/:sessionId/round/stream | Handler=router.post (debate.js:184) | Service=debate
  입력=params,body/header,auth-context | 출력=SSE/stream Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/debate.js | router.post | line 184]
E073 | HTTP | POST | /api/v1/debate/sessions/:sessionId/vote | Handler=router.post (debate.js:314) | Service=debate
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/debate.js | router.post | line 314]
E070 | HTTP | POST | /api/v1/debate/sessions/:sessionId/end | Handler=router.post (debate.js:358) | Service=debate
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/debate.js | router.post | line 358]
E075 | HTTP | GET | /api/v1/execute/runtimes | Handler=router.get (execute.js:11) | Service=execute
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: backend/src/routes/execute.js | router.get | line 11]
E074 | HTTP | POST | /api/v1/execute | Handler=router.post (execute.js:27) | Service=execute
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/execute.js | router.post | line 27]
E068 | WebSocket | Upgrade | /api/v1/chat/ws | Handler=initChatWebSocket (chat.js:929) | Service=chat
  입력=auth-context,upgrade | 출력=WebSocket stream | Auth=backend-key? [custom ws validation] | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=repository/DB 단위; 명시 트랜잭션은 핸들러별 | 테스트=미확인 | [근거: backend/src/routes/chat.js | initChatWebSocket | line 929]
E150 | HTTP | GET | /_health | Handler=app.get (index.ts:187) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/index.ts | app.get | line 187]
E367 | HTTP | GET | /healthz | Handler=app.get (index.ts:195) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/index.ts | app.get | line 195]
E366 | HTTP | GET | /health | Handler=app.get (index.ts:203) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/index.ts | app.get | line 203]
E343 | HTTP | GET | /api/v1/readiness | Handler=app.get (index.ts:207) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/index.ts | app.get | line 207]
E368 | HTTP | ALL | /metrics | Handler=app.all (index.ts:212) | Service=root
  입력=header/query | 출력=JSON ApiResponse/Response | Auth=blocked-at-edge | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/index.ts | app.all | line 212]
E369 | HTTP | GET | /public/config | Handler=app.get (index.ts:262) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/index.ts | app.get | line 262]
E330 | HTTP | GET | /api/v1/public/config | Handler=app.get (index.ts:266) | Service=root
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/index.ts | app.get | line 266]
E148 | HTTP | ALL | * | Handler=app.all (index.ts:274) | Service=root
  입력=header/query | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/index.ts | app.all | line 274]
E149 | HTTP | ALL | * | Handler=proxyToBackend (index.ts:274) | Service=proxy-fallback
  입력=auth-context | 출력=JSON ApiResponse/Response | Auth=proxy-policy | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/index.ts | proxyToBackend | line 274]
E237 | HTTP | POST | /api/v1/auth/oauth/handoff/consume | Handler=auth.post (auth.ts:276) | Service=auth
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.post | line 276]
E242 | HTTP | GET | /api/v1/auth/totp/status | Handler=auth.get (auth.ts:312) | Service=auth
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.get | line 312]
E240 | HTTP | GET | /api/v1/auth/totp/setup | Handler=auth.get (auth.ts:327) | Service=auth
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.get | line 327]
E241 | HTTP | POST | /api/v1/auth/totp/setup/verify | Handler=auth.post (auth.ts:378) | Service=auth
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.post | line 378]
E239 | HTTP | POST | /api/v1/auth/totp/challenge | Handler=auth.post (auth.ts:424) | Service=auth
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.post | line 424]
E243 | HTTP | POST | /api/v1/auth/totp/verify | Handler=auth.post (auth.ts:448) | Service=auth
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.post | line 448]
E233 | HTTP | GET | /api/v1/auth/oauth/github | Handler=auth.get (auth.ts:510) | Service=auth
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.get | line 510]
E234 | HTTP | GET | /api/v1/auth/oauth/github/callback | Handler=auth.get (auth.ts:540) | Service=auth
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.get | line 540]
E235 | HTTP | GET | /api/v1/auth/oauth/google | Handler=auth.get (auth.ts:620) | Service=auth
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.get | line 620]
E236 | HTTP | GET | /api/v1/auth/oauth/google/callback | Handler=auth.get (auth.ts:650) | Service=auth
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.get | line 650]
E238 | HTTP | POST | /api/v1/auth/refresh | Handler=auth.post (auth.ts:730) | Service=auth
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=미흡: KV CAS 없음 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.post | line 730]
E231 | HTTP | POST | /api/v1/auth/logout | Handler=auth.post (auth.ts:798) | Service=auth
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.post | line 798]
E232 | HTTP | GET | /api/v1/auth/me | Handler=auth.get (auth.ts:833) | Service=auth
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.get | line 833]
E229 | HTTP | POST | /api/v1/auth/anonymous | Handler=auth.post (auth.ts:875) | Service=auth
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.post | line 875]
E230 | HTTP | POST | /api/v1/auth/anonymous/refresh | Handler=auth.post (auth.ts:924) | Service=auth
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=KV, JWT, D1(OAuth handoff) | 멱등성=미흡: KV CAS 없음 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/auth.ts | auth.post | line 924]
E262 | HTTP | GET | /api/v1/comments/reactions/batch | Handler=comments.get (comments.ts:176) | Service=comments
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1 comments | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/comments.ts | comments.get | line 176]
E259 | HTTP | GET | /api/v1/comments/:commentId/reactions | Handler=comments.get (comments.ts:218) | Service=comments
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1 comments | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/comments.ts | comments.get | line 218]
E260 | HTTP | POST | /api/v1/comments/:commentId/reactions | Handler=comments.post (comments.ts:257) | Service=comments
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1 comments | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/comments.ts | comments.post | line 257]
E258 | HTTP | DELETE | /api/v1/comments/:commentId/reactions | Handler=comments.delete (comments.ts:310) | Service=comments
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1 comments | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/comments.ts | comments.delete | line 310]
E256 | HTTP | GET | /api/v1/comments | Handler=comments.get (comments.ts:341) | Service=comments
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1 comments | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/comments.ts | comments.get | line 341]
E257 | HTTP | POST | /api/v1/comments | Handler=comments.post (comments.ts:365) | Service=comments
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1 comments | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/comments.ts | comments.post | line 365]
E263 | HTTP | GET | /api/v1/comments/stream | Handler=comments.get (comments.ts:460) | Service=comments
  입력=query/header | 출력=SSE/stream Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1 comments | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/comments.ts | comments.get | line 460]
E261 | HTTP | DELETE | /api/v1/comments/:id | Handler=comments.delete (comments.ts:547) | Service=comments
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=D1 comments | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/comments.ts | comments.delete | line 547]
E214 | HTTP | POST | /api/v1/ai/sketch | Handler=ai.post (ai.ts:16) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 16]
E213 | HTTP | POST | /api/v1/ai/prism | Handler=ai.post (ai.ts:34) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 34]
E209 | HTTP | POST | /api/v1/ai/chain | Handler=ai.post (ai.ts:52) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 52]
E210 | HTTP | POST | /api/v1/ai/generate | Handler=ai.post (ai.ts:74) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 74]
E211 | HTTP | GET | /api/v1/ai/generate/stream | Handler=ai.get (ai.ts:95) | Service=ai
  입력=query/header | 출력=SSE/stream Response | Auth=public | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.get | line 95]
E216 | HTTP | POST | /api/v1/ai/summarize | Handler=ai.post (ai.ts:174) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 174]
E208 | HTTP | POST | /api/v1/ai/auto-chat | Handler=ai.post (ai.ts:194) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 194]
E217 | HTTP | POST | /api/v1/ai/vision/analyze | Handler=ai.post (ai.ts:221) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=backend/test/ai-vision-ssrf.test.js 일부 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 221]
E212 | HTTP | GET | /api/v1/ai/health | Handler=ai.get (ai.ts:248) | Service=ai
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/routes/ai.ts | ai.get | line 248]
E215 | HTTP | GET | /api/v1/ai/status | Handler=ai.get (ai.ts:261) | Service=ai
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.get | line 261]
E206 | HTTP | POST | /api/v1/ai/artifacts/read | Handler=ai.post (ai.ts:274) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 274]
E207 | HTTP | POST | /api/v1/ai/artifacts/read/batch | Handler=ai.post (ai.ts:299) | Service=ai
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/ai.ts | ai.post | line 299]
E251 | HTTP | POST | /api/v1/chat/session | Handler=chat.post (chat.ts:37) | Service=chat
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.post | line 37]
E253 | HTTP | POST | /api/v1/chat/session/:sessionId/message | Handler=chat.post (chat.ts:41) | Service=chat
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.post | line 41]
E254 | HTTP | POST | /api/v1/chat/session/:sessionId/task | Handler=chat.post (chat.ts:48) | Service=chat
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.post | line 48]
E252 | HTTP | POST | /api/v1/chat/session/:sessionId/lens-feed | Handler=chat.post (chat.ts:55) | Service=chat
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.post | line 55]
E255 | HTTP | POST | /api/v1/chat/session/:sessionId/thought-feed | Handler=chat.post (chat.ts:155) | Service=chat
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.post | line 155]
E244 | HTTP | POST | /api/v1/chat/aggregate | Handler=chat.post (chat.ts:254) | Service=chat
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.post | line 254]
E250 | HTTP | GET | /api/v1/chat/live/stream | Handler=chat.get (chat.ts:260) | Service=chat
  입력=query/header | 출력=SSE/stream Response | Auth=public | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.get | line 260]
E247 | HTTP | POST | /api/v1/chat/live/message | Handler=chat.post (chat.ts:267) | Service=chat
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.post | line 267]
E245 | HTTP | GET | /api/v1/chat/live/config | Handler=chat.get (chat.ts:273) | Service=chat
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.get | line 273]
E246 | HTTP | PUT | /api/v1/chat/live/config | Handler=chat.put (chat.ts:277) | Service=chat
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.put | line 277]
E248 | HTTP | GET | /api/v1/chat/live/room-stats | Handler=chat.get (chat.ts:281) | Service=chat
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.get | line 281]
E249 | HTTP | GET | /api/v1/chat/live/rooms | Handler=chat.get (chat.ts:286) | Service=chat
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend chat, SSE/WS, AI | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/chat.ts | chat.get | line 286]
E285 | HTTP | POST | /api/v1/images/upload | Handler=images.post (images.ts:80) | Service=images
  입력=body/header,file/form,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=R2, D1(attachments), AI vision? | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/images.ts | images.post | line 80]
E284 | HTTP | POST | /api/v1/images/presign | Handler=images.post (images.ts:88) | Service=images
  입력=body/header,file/form,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=R2, D1(attachments), AI vision? | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/images.ts | images.post | line 88]
E286 | HTTP | POST | /api/v1/images/upload-direct | Handler=images.post (images.ts:123) | Service=images
  입력=body/header,file/form,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=R2, D1(attachments), AI vision? | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/images.ts | images.post | line 123]
E283 | HTTP | POST | /api/v1/images/chat-upload | Handler=images.post (images.ts:196) | Service=images
  입력=body/header,file/form,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=R2, D1(attachments), AI vision?, Backend chat, SSE/WS, AI | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/images.ts | images.post | line 196]
E282 | HTTP | DELETE | /api/v1/images/:key | Handler=images.delete (images.ts:291) | Service=images
  입력=params,body/header,file/form,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=R2, D1(attachments), AI vision? | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/images.ts | images.delete | line 291]
E324 | HTTP | GET | /api/v1/og | Handler=og.get (og.ts:57) | Service=og
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/og.ts | og.get | line 57]
E228 | HTTP | POST | /api/v1/analytics/view | Handler=app.post (analytics.ts:66) | Service=analytics
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.post | line 66]
E225 | HTTP | GET | /api/v1/analytics/stats/:year/:slug | Handler=app.get (analytics.ts:92) | Service=analytics
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.get | line 92]
E221 | HTTP | GET | /api/v1/analytics/editor-picks | Handler=app.get (analytics.ts:128) | Service=analytics
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.get | line 128]
E226 | HTTP | GET | /api/v1/analytics/trending | Handler=app.get (analytics.ts:156) | Service=analytics
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.get | line 156]
E224 | HTTP | POST | /api/v1/analytics/refresh-stats | Handler=app.post (analytics.ts:199) | Service=analytics
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=미흡: KV CAS 없음 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.post | line 199]
E227 | HTTP | POST | /api/v1/analytics/update-editor-picks | Handler=app.post (analytics.ts:219) | Service=analytics
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.post | line 219]
E218 | HTTP | POST | /api/v1/analytics/admin/editor-picks | Handler=app.post (analytics.ts:264) | Service=analytics
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.post | line 264]
E220 | HTTP | PUT | /api/v1/analytics/admin/editor-picks/:year/:slug | Handler=app.put (analytics.ts:323) | Service=analytics
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.put | line 323]
E219 | HTTP | DELETE | /api/v1/analytics/admin/editor-picks/:year/:slug | Handler=app.delete (analytics.ts:381) | Service=analytics
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.delete | line 381]
E222 | HTTP | POST | /api/v1/analytics/heartbeat | Handler=app.post (analytics.ts:411) | Service=analytics
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1/Postgres analytics | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.post | line 411]
E223 | HTTP | GET | /api/v1/analytics/realtime | Handler=app.get (analytics.ts:435) | Service=analytics
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/Postgres analytics | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/analytics.ts | app.get | line 435]
E331 | HTTP | GET | /api/v1/public/posts/:year/:slug/translations/:targetLang | Handler=app.get (translate.ts:537) | Service=translate
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/translate.ts | app.get | line 537]
E332 | HTTP | GET | /api/v1/public/posts/:year/:slug/translations/:targetLang/cache | Handler=app.get (translate.ts:538) | Service=translate
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/translate.ts | app.get | line 538]
E350 | HTTP | POST | /api/v1/translate | Handler=app.post (translate.ts:551) | Service=translate
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/translate.ts | app.post | line 551]
E352 | HTTP | GET | /api/v1/translate/:year/:slug/:targetLang | Handler=app.get (translate.ts:590) | Service=translate
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/translate.ts | app.get | line 590]
E353 | HTTP | GET | /api/v1/translate/:year/:slug/:targetLang/status | Handler=app.get (translate.ts:594) | Service=translate
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/translate.ts | app.get | line 594]
E351 | HTTP | DELETE | /api/v1/translate/:year/:slug/:targetLang | Handler=app.delete (translate.ts:599) | Service=translate
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/translate.ts | app.delete | line 599]
E264 | HTTP | GET | /api/v1/config | Handler=config.get (config.ts:28) | Service=config
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/config.ts | config.get | line 28]
E266 | HTTP | PUT | /api/v1/config/:key | Handler=config.put (config.ts:47) | Service=config
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/config.ts | config.put | line 47]
E265 | HTTP | DELETE | /api/v1/config/:key | Handler=config.delete (config.ts:89) | Service=config
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/config.ts | config.delete | line 89]
E267 | HTTP | POST | /api/v1/config/clear-cache | Handler=config.post (config.ts:114) | Service=config
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/config.ts | config.post | line 114]
E341 | HTTP | POST | /api/v1/rag/search | Handler=rag.post (rag.ts:84) | Service=rag
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=external search | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.post | line 84]
E334 | HTTP | POST | /api/v1/rag/embed | Handler=rag.post (rag.ts:96) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.post | line 96]
E335 | HTTP | GET | /api/v1/rag/health | Handler=rag.get (rag.ts:103) | Service=rag
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/routes/rag.ts | rag.get | line 103]
E342 | HTTP | GET | /api/v1/rag/status | Handler=rag.get (rag.ts:111) | Service=rag
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.get | line 111]
E333 | HTTP | GET | /api/v1/rag/collections | Handler=rag.get (rag.ts:118) | Service=rag
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.get | line 118]
E336 | HTTP | POST | /api/v1/rag/index | Handler=rag.post (rag.ts:125) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.post | line 125]
E337 | HTTP | DELETE | /api/v1/rag/index/:documentId | Handler=rag.delete (rag.ts:132) | Service=rag
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.delete | line 132]
E339 | HTTP | POST | /api/v1/rag/memories/search | Handler=rag.post (rag.ts:140) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=external search | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.post | line 140]
E340 | HTTP | POST | /api/v1/rag/memories/upsert | Handler=rag.post (rag.ts:144) | Service=rag
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.post | line 144]
E338 | HTTP | DELETE | /api/v1/rag/memories/:userId/:memoryId | Handler=rag.delete (rag.ts:148) | Service=rag
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/rag.ts | rag.delete | line 148]
E309 | HTTP | GET | /api/v1/memos | Handler=memos.get (memos.ts:37) | Service=memos
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.get | line 37]
E310 | HTTP | PUT | /api/v1/memos | Handler=memos.put (memos.ts:79) | Service=memos
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.put | line 79]
E318 | HTTP | GET | /api/v1/memos/versions | Handler=memos.get (memos.ts:177) | Service=memos
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.get | line 177]
E319 | HTTP | GET | /api/v1/memos/versions/:version | Handler=memos.get (memos.ts:230) | Service=memos
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.get | line 230]
E317 | HTTP | POST | /api/v1/memos/restore/:version | Handler=memos.post (memos.ts:281) | Service=memos
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.post | line 281]
E308 | HTTP | DELETE | /api/v1/memos | Handler=memos.delete (memos.ts:349) | Service=memos
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.delete | line 349]
E312 | HTTP | GET | /api/v1/memos/:userId | Handler=memos.get (memos.ts:386) | Service=memos
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.get | line 386]
E313 | HTTP | PUT | /api/v1/memos/:userId | Handler=memos.put (memos.ts:428) | Service=memos
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.put | line 428]
E315 | HTTP | GET | /api/v1/memos/:userId/versions | Handler=memos.get (memos.ts:532) | Service=memos
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.get | line 532]
E316 | HTTP | GET | /api/v1/memos/:userId/versions/:version | Handler=memos.get (memos.ts:587) | Service=memos
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.get | line 587]
E314 | HTTP | POST | /api/v1/memos/:userId/restore/:version | Handler=memos.post (memos.ts:642) | Service=memos
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.post | line 642]
E311 | HTTP | DELETE | /api/v1/memos/:userId | Handler=memos.delete (memos.ts:717) | Service=memos
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memos.ts | memos.delete | line 717]
E294 | HTTP | GET | /api/v1/memories/:userId | Handler=memories.get (memories.ts:89) | Service=memories
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.get | line 89]
E295 | HTTP | POST | /api/v1/memories/:userId | Handler=memories.post (memories.ts:158) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.post | line 158]
E299 | HTTP | POST | /api/v1/memories/:userId/batch | Handler=memories.post (memories.ts:231) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.post | line 231]
E297 | HTTP | PATCH | /api/v1/memories/:userId/:memoryId | Handler=memories.patch (memories.ts:308) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.patch | line 308]
E296 | HTTP | DELETE | /api/v1/memories/:userId/:memoryId | Handler=memories.delete (memories.ts:398) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.delete | line 398]
E298 | HTTP | POST | /api/v1/memories/:userId/access/:memoryId | Handler=memories.post (memories.ts:435) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.post | line 435]
E301 | HTTP | GET | /api/v1/memories/:userId/sessions | Handler=memories.get (memories.ts:462) | Service=memories
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.get | line 462]
E302 | HTTP | POST | /api/v1/memories/:userId/sessions | Handler=memories.post (memories.ts:508) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.post | line 508]
E304 | HTTP | GET | /api/v1/memories/:userId/sessions/:sessionId | Handler=memories.get (memories.ts:545) | Service=memories
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.get | line 545]
E306 | HTTP | POST | /api/v1/memories/:userId/sessions/:sessionId/messages | Handler=memories.post (memories.ts:602) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.post | line 602]
E307 | HTTP | POST | /api/v1/memories/:userId/sessions/:sessionId/messages/batch | Handler=memories.post (memories.ts:672) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.post | line 672]
E305 | HTTP | PATCH | /api/v1/memories/:userId/sessions/:sessionId | Handler=memories.patch (memories.ts:749) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.patch | line 749]
E303 | HTTP | DELETE | /api/v1/memories/:userId/sessions/:sessionId | Handler=memories.delete (memories.ts:798) | Service=memories
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1/R2 user state | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.delete | line 798]
E300 | HTTP | GET | /api/v1/memories/:userId/context | Handler=memories.get (memories.ts:824) | Service=memories
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/memories.ts | memories.get | line 824]
E168 | HTTP | GET | /api/v1/admin/ai/providers | Handler=providers.get (providers.ts:11) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.get | line 11]
E171 | HTTP | GET | /api/v1/admin/ai/providers/:id | Handler=providers.get (providers.ts:28) | Service=admin-ai
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.get | line 28]
E169 | HTTP | POST | /api/v1/admin/ai/providers | Handler=providers.post (providers.ts:58) | Service=admin-ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.post | line 58]
E172 | HTTP | PUT | /api/v1/admin/ai/providers/:id | Handler=providers.put (providers.ts:97) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.put | line 97]
E174 | HTTP | PUT | /api/v1/admin/ai/providers/:id/health | Handler=providers.put (providers.ts:147) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.put | line 147]
E175 | HTTP | POST | /api/v1/admin/ai/providers/:id/kill-switch | Handler=providers.post (providers.ts:237) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.post | line 237]
E173 | HTTP | POST | /api/v1/admin/ai/providers/:id/enable | Handler=providers.post (providers.ts:276) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.post | line 276]
E170 | HTTP | DELETE | /api/v1/admin/ai/providers/:id | Handler=providers.delete (providers.ts:305) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/providers.ts | providers.delete | line 305]
E152 | HTTP | GET | /api/v1/admin/ai/models | Handler=models.get (models.ts:11) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/models.ts | models.get | line 11]
E155 | HTTP | GET | /api/v1/admin/ai/models/:id | Handler=models.get (models.ts:51) | Service=admin-ai
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/models.ts | models.get | line 51]
E153 | HTTP | POST | /api/v1/admin/ai/models | Handler=models.post (models.ts:75) | Service=admin-ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/models.ts | models.post | line 75]
E156 | HTTP | PUT | /api/v1/admin/ai/models/:id | Handler=models.put (models.ts:166) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/models.ts | models.put | line 166]
E154 | HTTP | DELETE | /api/v1/admin/ai/models/:id | Handler=models.delete (models.ts:287) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/models.ts | models.delete | line 287]
E176 | HTTP | GET | /api/v1/admin/ai/routes | Handler=routes.get (routes.ts:11) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.get | line 11]
E179 | HTTP | GET | /api/v1/admin/ai/routes/:id | Handler=routes.get (routes.ts:31) | Service=admin-ai
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.get | line 31]
E177 | HTTP | POST | /api/v1/admin/ai/routes | Handler=routes.post (routes.ts:55) | Service=admin-ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.post | line 55]
E180 | HTTP | PUT | /api/v1/admin/ai/routes/:id | Handler=routes.put (routes.ts:127) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.put | line 127]
E178 | HTTP | DELETE | /api/v1/admin/ai/routes/:id | Handler=routes.delete (routes.ts:244) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/routes.ts | routes.delete | line 244]
E184 | HTTP | GET | /api/v1/admin/ai/usage | Handler=usage.get (usage.ts:11) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/usage.ts | usage.get | line 11]
E185 | HTTP | POST | /api/v1/admin/ai/usage/log | Handler=usage.post (usage.ts:101) | Service=admin-ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/usage.ts | usage.post | line 101]
E151 | HTTP | GET | /api/v1/admin/ai/config/export | Handler=config.get (config.ts:10) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/config.ts | config.get | line 10]
E157 | HTTP | GET | /api/v1/admin/ai/overview | Handler=overview.get (overview.ts:9) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/overview.ts | overview.get | line 9]
E181 | HTTP | GET | /api/v1/admin/ai/traces | Handler=traces.get (traces.ts:9) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/traces.ts | traces.get | line 9]
E182 | HTTP | GET | /api/v1/admin/ai/traces/:traceId | Handler=traces.get (traces.ts:71) | Service=admin-ai
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/traces.ts | traces.get | line 71]
E183 | HTTP | GET | /api/v1/admin/ai/traces/stats/summary | Handler=traces.get (traces.ts:101) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/traces.ts | traces.get | line 101]
E162 | HTTP | POST | /api/v1/admin/ai/playground/run | Handler=playground.post (playground.ts:12) | Service=admin-ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.post | line 12]
E159 | HTTP | GET | /api/v1/admin/ai/playground/history | Handler=playground.get (playground.ts:210) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.get | line 210]
E161 | HTTP | GET | /api/v1/admin/ai/playground/history/:id | Handler=playground.get (playground.ts:259) | Service=admin-ai
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.get | line 259]
E160 | HTTP | DELETE | /api/v1/admin/ai/playground/history/:id | Handler=playground.delete (playground.ts:276) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.delete | line 276]
E158 | HTTP | DELETE | /api/v1/admin/ai/playground/history | Handler=playground.delete (playground.ts:295) | Service=admin-ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/playground.ts | playground.delete | line 295]
E163 | HTTP | GET | /api/v1/admin/ai/prompt-templates | Handler=templates.get (templates.ts:11) | Service=admin-ai
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.get | line 11]
E164 | HTTP | POST | /api/v1/admin/ai/prompt-templates | Handler=templates.post (templates.ts:37) | Service=admin-ai
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.post | line 37]
E166 | HTTP | PUT | /api/v1/admin/ai/prompt-templates/:id | Handler=templates.put (templates.ts:105) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.put | line 105]
E165 | HTTP | DELETE | /api/v1/admin/ai/prompt-templates/:id | Handler=templates.delete (templates.ts:214) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.delete | line 214]
E167 | HTTP | POST | /api/v1/admin/ai/prompt-templates/:id/use | Handler=templates.post (templates.ts:237) | Service=admin-ai
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-ai/templates.ts | templates.post | line 237]
E188 | HTTP | GET | /api/v1/admin/outbox/:stream | Handler=adminOutbox.get (admin-outbox.ts:45) | Service=admin-outbox
  입력=params,query/header,auth-context | 출력=SSE/stream Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-outbox.ts | adminOutbox.get | line 45]
E191 | HTTP | POST | /api/v1/admin/outbox/:stream/replay | Handler=adminOutbox.post (admin-outbox.ts:81) | Service=admin-outbox
  입력=params,body/header,auth-context | 출력=SSE/stream Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-outbox.ts | adminOutbox.post | line 81]
E189 | HTTP | POST | /api/v1/admin/outbox/:stream/ai-flush | Handler=adminOutbox.post (admin-outbox.ts:118) | Service=admin-outbox
  입력=params,body/header,auth-context | 출력=SSE/stream Response | Auth=admin | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-outbox.ts | adminOutbox.post | line 118]
E190 | HTTP | POST | /api/v1/admin/outbox/:stream/flush | Handler=adminOutbox.post (admin-outbox.ts:130) | Service=admin-outbox
  입력=params,body/header,auth-context | 출력=SSE/stream Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-outbox.ts | adminOutbox.post | line 130]
E199 | HTTP | GET | /api/v1/admin/secrets/categories | Handler=secrets.get (secrets.ts:109) | Service=admin-secrets
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 109]
E200 | HTTP | POST | /api/v1/admin/secrets/categories | Handler=secrets.post (secrets.ts:120) | Service=admin-secrets
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 120]
E192 | HTTP | GET | /api/v1/admin/secrets | Handler=secrets.get (secrets.ts:166) | Service=admin-secrets
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 166]
E195 | HTTP | GET | /api/v1/admin/secrets/:id | Handler=secrets.get (secrets.ts:201) | Service=admin-secrets
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 201]
E193 | HTTP | POST | /api/v1/admin/secrets | Handler=secrets.post (secrets.ts:244) | Service=admin-secrets
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 244]
E196 | HTTP | PUT | /api/v1/admin/secrets/:id | Handler=secrets.put (secrets.ts:349) | Service=admin-secrets
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.put | line 349]
E194 | HTTP | DELETE | /api/v1/admin/secrets/:id | Handler=secrets.delete (secrets.ts:490) | Service=admin-secrets
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.delete | line 490]
E197 | HTTP | POST | /api/v1/admin/secrets/:id/reveal | Handler=secrets.post (secrets.ts:535) | Service=admin-secrets
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 535]
E202 | HTTP | POST | /api/v1/admin/secrets/generate | Handler=secrets.post (secrets.ts:574) | Service=admin-secrets
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 574]
E201 | HTTP | GET | /api/v1/admin/secrets/export | Handler=secrets.get (secrets.ts:605) | Service=admin-secrets
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 605]
E204 | HTTP | POST | /api/v1/admin/secrets/import | Handler=secrets.post (secrets.ts:656) | Service=admin-secrets
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.post | line 656]
E198 | HTTP | GET | /api/v1/admin/secrets/audit | Handler=secrets.get (secrets.ts:771) | Service=admin-secrets
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 771]
E203 | HTTP | GET | /api/v1/admin/secrets/health | Handler=secrets.get (secrets.ts:835) | Service=admin-secrets
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 835]
E205 | HTTP | GET | /api/v1/admin/secrets/overview | Handler=secrets.get (secrets.ts:861) | Service=admin-secrets
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/secrets.ts | secrets.get | line 861]
E287 | HTTP | GET | /api/v1/internal/ai-config | Handler=internal.get (internal.ts:107) | Service=internal
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/internal.ts | internal.get | line 107]
E288 | HTTP | GET | /api/v1/internal/ai-config/providers | Handler=internal.get (internal.ts:121) | Service=internal
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/internal.ts | internal.get | line 121]
E291 | HTTP | GET | /api/v1/internal/ai/resources | Handler=internal.get (internal.ts:178) | Service=internal
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/internal.ts | internal.get | line 178]
E290 | HTTP | GET | /api/v1/internal/ai/outbox/status | Handler=internal.get (internal.ts:188) | Service=internal
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=아니오/읽기
  부수효과=Backend AI, external LLM | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/internal.ts | internal.get | line 188]
E289 | HTTP | POST | /api/v1/internal/ai/outbox/flush | Handler=internal.post (internal.ts:215) | Service=internal
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/internal.ts | internal.post | line 215]
E292 | HTTP | POST | /api/v1/internal/ai/warm | Handler=internal.post (internal.ts:229) | Service=internal
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/internal.ts | internal.post | line 229]
E293 | HTTP | POST | /api/v1/internal/ai/warm/revisit | Handler=internal.post (internal.ts:326) | Service=internal
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=backend-key | 상태변경=예/조건부
  부수효과=Backend AI, external LLM | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/internal.ts | internal.post | line 326]
E325 | HTTP | GET | /api/v1/personas | Handler=personas.get (personas.ts:106) | Service=personas
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/personas.ts | personas.get | line 106]
E328 | HTTP | GET | /api/v1/personas/:id | Handler=personas.get (personas.ts:156) | Service=personas
  입력=params,query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/personas.ts | personas.get | line 156]
E326 | HTTP | POST | /api/v1/personas | Handler=personas.post (personas.ts:186) | Service=personas
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/personas.ts | personas.post | line 186]
E329 | HTTP | PUT | /api/v1/personas/:id | Handler=personas.put (personas.ts:247) | Service=personas
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/personas.ts | personas.put | line 247]
E327 | HTTP | DELETE | /api/v1/personas/:id | Handler=personas.delete (personas.ts:318) | Service=personas
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/personas.ts | personas.delete | line 318]
E354 | HTTP | GET | /api/v1/user-content/memos | Handler=userContent.get (user-content.ts:62) | Service=user-content
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/user-content.ts | userContent.get | line 62]
E357 | HTTP | GET | /api/v1/user-content/memos/:id | Handler=userContent.get (user-content.ts:98) | Service=user-content
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/user-content.ts | userContent.get | line 98]
E355 | HTTP | POST | /api/v1/user-content/memos | Handler=userContent.post (user-content.ts:123) | Service=user-content
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/user-content.ts | userContent.post | line 123]
E358 | HTTP | PUT | /api/v1/user-content/memos/:id | Handler=userContent.put (user-content.ts:176) | Service=user-content
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/user-content.ts | userContent.put | line 176]
E356 | HTTP | DELETE | /api/v1/user-content/memos/:id | Handler=userContent.delete (user-content.ts:235) | Service=user-content
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1(user/session/preferences), D1/R2 user state | 멱등성=부분/조건부 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/user-content.ts | userContent.delete | line 235]
E345 | HTTP | POST | /api/v1/search/web | Handler=search.post (search.ts:205) | Service=search
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=external search | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/search.ts | search.post | line 205]
E344 | HTTP | GET | /api/v1/search/health | Handler=search.get (search.ts:298) | Service=search
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=external search | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/routes/search.ts | search.get | line 298]
E361 | HTTP | POST | /api/v1/user/session | Handler=user.post (user.ts:220) | Service=user
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=workers/api-gateway/test/user-session-contract.test.ts | [근거: workers/api-gateway/src/routes/user.ts | user.post | line 220]
E365 | HTTP | GET | /api/v1/user/session/verify | Handler=user.get (user.ts:313) | Service=user
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=workers/api-gateway/test/user-session-contract.test.ts | [근거: workers/api-gateway/src/routes/user.ts | user.get | line 313]
E362 | HTTP | GET | /api/v1/user/session/:token | Handler=user.get (user.ts:336) | Service=user
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=workers/api-gateway/test/user-session-contract.test.ts | [근거: workers/api-gateway/src/routes/user.ts | user.get | line 336]
E364 | HTTP | POST | /api/v1/user/session/recover | Handler=user.post (user.ts:345) | Service=user
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=보강됨: active 조건부 비활성화 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=workers/api-gateway/test/user-session-contract.test.ts | [근거: workers/api-gateway/src/routes/user.ts | user.post | line 345]
E363 | HTTP | POST | /api/v1/user/session/:token/recover | Handler=user.post (user.ts:360) | Service=user
  입력=params,body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=workers/api-gateway/test/user-session-contract.test.ts | [근거: workers/api-gateway/src/routes/user.ts | user.post | line 360]
E360 | HTTP | PUT | /api/v1/user/preferences | Handler=user.put (user.ts:374) | Service=user
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=D1(user/session/preferences) | 멱등성=upsert 기반 부분 보장 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/user.ts | user.put | line 374]
E359 | HTTP | GET | /api/v1/user/preferences | Handler=user.get (user.ts:418) | Service=user
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=D1(user/session/preferences) | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/user.ts | user.get | line 418]
E269 | HTTP | POST | /api/v1/debate/sessions | Handler=debate.post (debate.ts:100) | Service=debate
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/debate.ts | debate.post | line 100]
E270 | HTTP | GET | /api/v1/debate/sessions/:id | Handler=debate.get (debate.ts:159) | Service=debate
  입력=params,query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/debate.ts | debate.get | line 159]
E272 | HTTP | POST | /api/v1/debate/sessions/:id/round | Handler=debate.post (debate.ts:228) | Service=debate
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/debate.ts | debate.post | line 228]
E273 | HTTP | POST | /api/v1/debate/sessions/:id/round/stream | Handler=debate.post (debate.ts:379) | Service=debate
  입력=params,body/header,auth-context | 출력=SSE/stream Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/debate.ts | debate.post | line 379]
E274 | HTTP | POST | /api/v1/debate/sessions/:id/vote | Handler=debate.post (debate.ts:423) | Service=debate
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/debate.ts | debate.post | line 423]
E271 | HTTP | POST | /api/v1/debate/sessions/:id/end | Handler=debate.post (debate.ts:498) | Service=debate
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/debate.ts | debate.post | line 498]
E346 | HTTP | POST | /api/v1/subscribe | Handler=app.post (subscribe.ts:95) | Service=subscribe
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/subscribe.ts | app.post | line 95]
E347 | HTTP | GET | /api/v1/subscribe/confirm | Handler=app.get (subscribe.ts:172) | Service=subscribe
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/subscribe.ts | app.get | line 172]
E349 | HTTP | GET | /api/v1/subscribe/unsubscribe | Handler=app.get (subscribe.ts:207) | Service=subscribe
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/subscribe.ts | app.get | line 207]
E348 | HTTP | GET | /api/v1/subscribe/count | Handler=app.get (subscribe.ts:239) | Service=subscribe
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/subscribe.ts | app.get | line 239]
E268 | HTTP | POST | /api/v1/contact | Handler=app.post (contact.ts:14) | Service=contact
  입력=body/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/contact.ts | app.post | line 14]
E322 | HTTP | GET | /api/v1/notifications/stream | Handler=notifications.get (notifications.ts:8) | Service=notifications
  입력=query/header,auth-context | 출력=SSE/stream Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=D1 notifications, SSE | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/notifications.service.test.js 일부 | [근거: workers/api-gateway/src/routes/notifications.ts | notifications.get | line 8]
E323 | HTTP | GET | /api/v1/notifications/unread | Handler=notifications.get (notifications.ts:16) | Service=notifications
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=D1 notifications, SSE | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/notifications.service.test.js 일부 | [근거: workers/api-gateway/src/routes/notifications.ts | notifications.get | line 16]
E321 | HTTP | GET | /api/v1/notifications/history | Handler=notifications.get (notifications.ts:23) | Service=notifications
  입력=query/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=아니오/읽기
  부수효과=D1 notifications, SSE | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/notifications.service.test.js 일부 | [근거: workers/api-gateway/src/routes/notifications.ts | notifications.get | line 23]
E320 | HTTP | PATCH | /api/v1/notifications/:notificationId/read | Handler=notifications.patch (notifications.ts:30) | Service=notifications
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=D1 notifications, SSE | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=backend/test/notifications.service.test.js 일부 | [근거: workers/api-gateway/src/routes/notifications.ts | notifications.patch | line 30]
E186 | HTTP | GET | /api/v1/admin/logs | Handler=adminLogs.get (admin-logs.ts:68) | Service=admin-logs
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-logs.ts | adminLogs.get | line 68]
E187 | HTTP | GET | /api/v1/admin/logs/stream | Handler=adminLogs.get (admin-logs.ts:85) | Service=admin-logs
  입력=query/header | 출력=SSE/stream Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/admin-logs.ts | adminLogs.get | line 85]
E275 | HTTP | POST | /api/v1/gateway/call/auto-chat | Handler=gateway.post (gateway.ts:91) | Service=gateway
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/gateway.ts | gateway.post | line 91]
E276 | HTTP | GET | /api/v1/gateway/call/health | Handler=gateway.get (gateway.ts:105) | Service=gateway
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/routes/gateway.ts | gateway.get | line 105]
E277 | HTTP | GET | /api/v1/gateway/call/status | Handler=gateway.get (gateway.ts:117) | Service=gateway
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/gateway.ts | gateway.get | line 117]
E280 | HTTP | POST | /api/v1/gateway/vision/analyze | Handler=gateway.post (gateway.ts:228) | Service=gateway
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=auth | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/gateway.ts | gateway.post | line 228]
E281 | HTTP | GET | /api/v1/gateway/vision/health | Handler=gateway.get (gateway.ts:270) | Service=gateway
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/api-gateway/src/routes/gateway.ts | gateway.get | line 270]
E278 | HTTP | GET | /api/v1/gateway/config | Handler=gateway.get (gateway.ts:286) | Service=gateway
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=none observed/static | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/gateway.ts | gateway.get | line 286]
E279 | HTTP | PUT | /api/v1/gateway/config | Handler=gateway.put (gateway.ts:306) | Service=gateway
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin | 상태변경=예/조건부
  부수효과=none observed/static | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/routes/gateway.ts | gateway.put | line 306]
E370 | ScheduledEvent | CRON | scheduled() | Handler=scheduled (index.ts:284) | Service=cron
  입력=cron-event | 출력=cron side-effect only | Auth=Cloudflare cron | 상태변경=예
  부수효과=D1 cleanup, outbox flush, backend refresh | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=D1/KV/R2 단일 호출 중심; multi-step 원자성 제한 | 테스트=미확인 | [근거: workers/api-gateway/src/index.ts | scheduled | line 284]
E142 | HTTP | GET/HEAD/OPTIONS | /{assets|ai-chat|images|posts|assets}/* | Handler=handleAssetRequest (index.ts:223) | Service=r2-public-assets
  입력=params,query/header,file/form | 출력=object stream/headers | Auth=public | 상태변경=아니오/읽기
  부수효과=R2 | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/r2-gateway/src/index.ts | handleAssetRequest | line 223]
E141 | HTTP | GET/HEAD/PUT/DELETE | /internal/:resource/:userId/:id? | Handler=handleInternalRequest (index.ts:234) | Service=r2-internal-json
  입력=params,body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=X-Internal-Key | 상태변경=예/조건부
  부수효과=R2 | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=런타임별 단일 operation | 테스트=미확인 | [근거: workers/r2-gateway/src/index.ts | handleInternalRequest | line 234]
E140 | HTTP | GET | / | Handler=status (index.ts:216) | Service=r2-health
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=R2 | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/r2-gateway/src/index.ts | status | line 216]
E144 | HTTP | GET | /health | Handler=health (index.ts:133) | Service=seo-health
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=frontend/origin proxy | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/seo-gateway/src/index.ts | health | line 133]
E143 | HTTP | GET | /* | Handler=fetch/rewrite-or-proxy (index.ts:160) | Service=seo-proxy
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=frontend/origin proxy | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=미확인 | [근거: workers/seo-gateway/src/index.ts | fetch/rewrite-or-proxy | line 160]
E145 | HTTP | GET | /health | Handler=health (index.ts:156) | Service=terminal-health
  입력=query/header | 출력=JSON ApiResponse/Response | Auth=public | 상태변경=아니오/읽기
  부수효과=terminal origin, WebSocket | 멱등성=읽기 멱등 | 트랜잭션=없음 | 테스트=backend/test/readiness.test.js 일부 | [근거: workers/terminal-gateway/src/index.ts | health | line 156]
E146 | HTTP | POST/DELETE/OPTIONS | /session | Handler=handleSessionRequest (index.ts:162) | Service=terminal-session-ticket
  입력=body/header,auth-context | 출력=JSON ApiResponse/Response | Auth=admin JWT + Origin | 상태변경=예/조건부
  부수효과=terminal origin, WebSocket | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=런타임별 단일 operation | 테스트=미확인 | [근거: workers/terminal-gateway/src/index.ts | handleSessionRequest | line 162]
E147 | WebSocket | GET Upgrade | /terminal | Handler=fetch->origin websocket (index.ts:166) | Service=terminal-ws
  입력=query/header,auth-context,upgrade | 출력=WebSocket stream | Auth=admin JWT or terminal ticket | 상태변경=아니오/읽기
  부수효과=terminal origin, WebSocket | 멱등성=미보장/핸들러별 확인 필요 | 트랜잭션=런타임별 단일 operation | 테스트=미확인 | [근거: workers/terminal-gateway/src/index.ts | fetch->origin websocket | line 166]

# 4. 핵심 사용자 시나리오별 E2E 추적
## 시나리오 A. 익명 사용자 세션 생성 → 검증 → 복구
- 관련 엔드포인트/이벤트: POST /api/v1/user/session, GET /api/v1/user/session/verify, POST /api/v1/user/session/recover, 폐기된 GET/POST /session/:token*. [근거: workers/api-gateway/src/routes/user.ts | line 274-365]
단계 | 입력 데이터 형태 | 변환 규칙 | 출력 데이터 형태 | 상태 영향 | 부수효과 | 실패 모드 | 근거
--- | --- | --- | --- | --- | --- | --- | ---
1 수신 | fingerprint/body + UA/IP/country | JSON parse, fingerprint normalize | 내부 fingerprint/session create command | 없음 | 없음 | body parse/필수값 실패 | [근거: workers/api-gateway/src/routes/user.ts | POST /session | line 274-305]
2 저장 | raw session token | sha256Hex(token), sessionTokenMarker(hash) | DB row: session_token=sess_<hash-prefix>, session_token_hash=<hash> | user_sessions insert | D1 write | DB unique/insert failure | [근거: workers/api-gateway/src/routes/user.ts | hashSessionToken + insert | line 35-44, 284-293]
3 검증 | Authorization bearer/sessionToken header | token hash lookup + legacy plaintext fallback | session DTO with presented token | last_activity update | D1 update | expired/inactive/missing -> 404 | [근거: workers/api-gateway/src/routes/user.ts | findActiveSessionByToken/verify | line 91-107, 316-329]
4 복구 | old active token in body/header | active-only lookup, conditional deactivate, new token hash insert | new session DTO with new token | old is_active=0, new row active | D1 update+insert | old token replay -> 404/409-like invalid state | [근거: workers/api-gateway/src/routes/user.ts | recoverSessionByToken | line 173-213]
5 legacy URL | /session/:token path | no token use, hard deprecate | 410 error | 상태 변경 없음 | 없음 | client must migrate | [근거: workers/api-gateway/src/routes/user.ts | deprecated URL routes | line 336-365]

상태 변화 타임라인: ABSENT -> ACTIVE(session_hash) -> VERIFIED(touch last_activity) -> RECOVERING(old active locked by conditional update) -> OLD_REVOKED + NEW_ACTIVE. 금지 상태는 동일 old token으로 두 개 이상의 active recovered session을 만드는 것이다. 패치 후 deactivate WHERE id=? AND is_active=1 결과를 확인하므로 동일 row의 중복 복구를 차단한다. [근거: workers/api-gateway/src/routes/user.ts | deactivateSessionIfActive | line 135-147]
실패 경로: expired/inactive token, migration 미적용으로 session_token_hash 컬럼 부재, DB insert failure, race로 deactivate changes=0. migration 미적용은 배포 전 blocker다. [근거: workers/migrations/0031_user_session_token_hash.sql]
동시성/재시도 위험: D1 update changes 검사는 같은 old session row에 대한 중복 복구를 억제하지만, 완전한 transaction wrapper는 확인되지 않았다. update와 insert 사이 partial failure가 있으면 old revoked/new missing 상태 가능성이 남는다. [추정: recover update+insert transaction block 미확인, workers/api-gateway/src/routes/user.ts | line 182-203]
보안 경계: token은 URL path에서 제거되었고, DB에는 hash/marker만 저장된다. [근거: workers/api-gateway/src/routes/user.ts | line 35-44, 336-365]
관측성 포인트: recover success/failure, deprecated URL endpoint hit count, deactivate changes=0, migration error, 404 invalid token rate를 metric/log로 추가해야 한다. [미확인: 현재 invariant metric 미탐지]

## 시나리오 B. OAuth/TOTP/Refresh 인증 흐름
- 관련 엔드포인트: /auth/oauth/*, /auth/totp/*, /auth/refresh, /auth/logout, /auth/me, /auth/anonymous*. [근거: workers/api-gateway/src/routes/auth.ts | line 276-924]
단계 | 입력 | 변환 | 상태 영향 | 실패/위험 | 근거
--- | --- | --- | --- | --- | ---
OAuth start | provider request | state 생성 후 KV put | OAuth state transient | state TTL drift/redirect mismatch | [근거: workers/api-gateway/src/routes/auth.ts | OAuth state KV put | line 510-664]
OAuth callback | code+state | KV state get/delete, provider token exchange | handoff/refresh token 발급 | provider timeout, state replay window | [근거: workers/api-gateway/src/routes/auth.ts | callback | line 540-730]
TOTP setup/verify | TOTP code | secret KV get, verify, setup flag put | setupComplete=true | KV race, last-step CAS 부재 | [근거: workers/api-gateway/src/routes/auth.ts | TOTP setup/verify | line 327-411]
TOTP challenge/verify | challengeId+code | KV challenge get/delete, secret verify | access/refresh token 발급 가능 | get/delete 비원자성으로 double consume 가능 | [근거: workers/api-gateway/src/routes/auth.ts | challenge/verify | line 424-467]
Refresh | refresh JWT | KV token/family lookup, rotation | old token invalid/new token active | KV eventual consistency/replay race | [근거: workers/api-gateway/src/routes/auth.ts | refresh | line 730-798]
Logout | refresh token | KV delete/family revoke | token invalidation | partial revoke | [근거: workers/api-gateway/src/routes/auth.ts | logout | line 798-833]
불변식: 같은 refresh token jti는 한 번만 소비되어야 하고, 같은 TOTP step/challenge는 재사용되면 안 된다. 현재 KV put/delete만으로는 강한 중복소비 억제가 보장되지 않으므로 Durable Object/D1 transaction store로 옮기는 것이 우선 개선안이다.

## 시나리오 C. 공개 AI 생성/요약/비전 요청
- 관련 엔드포인트: POST /ai/generate, GET /ai/generate/stream, POST /ai/auto-chat, POST /ai/vision/analyze, artifacts read. [근거: workers/api-gateway/src/routes/ai.ts | line 74-299]
데이터 흐름: user prompt/query/file metadata -> request parse/default temperature -> AI service/provider -> streamed or JSON response. 상태 변경은 명시 DB write가 아니라 외부 provider 비용/latency와 artifact read side effect 가능성이다. [근거: workers/api-gateway/src/routes/ai.ts | generate/stream/vision/artifacts]
실패/운영 위험: public generation route의 quota budget, provider timeout/circuit breaker, prompt abuse logging, request id trace propagation이 충분히 명시되지 않았다. [미확인: 중앙 quota/circuit breaker metric 미탐지]

## 시나리오 D. 댓글/반응 생성 및 SSE stream
- 관련 엔드포인트: GET/POST /comments, GET/POST/DELETE /comments/:id/reactions, GET /comments/stream, DELETE /comments/:id admin. [근거: workers/api-gateway/src/routes/comments.ts | line 176-547]
데이터 흐름: public body(postId/comment/reaction) -> normalizePostIdentifier -> D1 insert/update/delete -> SSE/history response. 댓글 생성에는 too-many-comments 메시지가 존재해 rate/abuse guard 흔적은 있으나 동시성/중복 event idempotency는 별도 확인이 필요하다. [근거: workers/api-gateway/src/routes/comments.ts | normalize/rate message | line 30, 365-423, 460-547]
불변식: 같은 actor가 같은 comment에 중복 reaction을 만들지 않아야 하고, admin delete 후 stream/history에서 삭제 상태가 일관되어야 한다. 테스트 커버리지는 endpoint map상 제한적이다. [미확인: reaction uniqueness transaction test 미탐지]

## 시나리오 E. 이미지 업로드/삭제
- 관련 엔드포인트: POST /images/upload, /presign, /upload-direct(admin), /chat-upload(auth), DELETE /images/:key(admin). [근거: workers/api-gateway/src/routes/images.ts | line 80-300]
데이터 흐름: multipart file/name/postId -> sanitized key -> R2 put -> URL/key response; delete는 admin auth 후 R2 delete. [근거: workers/api-gateway/src/routes/images.ts | key generation/R2 put/delete | line 107-300]
위험: content-type/extension만 신뢰하면 polyglot/magic-byte mismatch, oversized file memory pressure, orphan upload cleanup 부재가 발생할 수 있다. [미확인: magic-byte validation/stream backpressure 확인 불가]

## 시나리오 F. Backend proxy와 internal route
- 관련 경로: Worker catch-all /api/v1/* proxy, backend protected registry, internal Worker routes. [근거: workers/api-gateway/src/index.ts | line 36-179, 274-276] [근거: backend/src/index.js | app.use(requireBackendKey) | line 117]
데이터 흐름: client request -> Worker route miss -> canProxyPath -> backend URL -> inject X-Backend-Key -> backend requireBackendKey -> route handler. Proxy path allowlist drift는 backend-only API 노출/차단 문제로 이어진다. [근거: shared/src/contracts/service-boundaries.js | boundary contract]
패치: internal.ts는 모든 internal route에 중앙 middleware가 적용되도록 변경했다. [근거: workers/api-gateway/src/routes/internal.ts | internal.use | line 70-76]

# 5. 핵심 엔드포인트 상세 추적
## Endpoint: POST /api/v1/user/session
- 목적: 익명 fingerprint 기반 session 생성. 입력 계약: body fingerprint/userAgent/ip/country 유사 값, headers. 출력 계약: session DTO + presented raw token. [근거: workers/api-gateway/src/routes/user.ts | POST /session | line 274-305]
- 처리 단계: parse -> token 생성 -> hashSessionToken -> sessionTokenMarker -> INSERT user_sessions(id,fingerprint_id,session_token,session_token_hash,...) -> response. [근거: workers/api-gateway/src/routes/user.ts | line 35-44, 284-293]
- before 예시: {fingerprintId:"fp_1", userAgent:"UA"}. after DB 예시: {session_token:"sess_abcd...", session_token_hash:"<sha256>", is_active:1, expires_at:"..."}. response 예시: {sessionToken:"raw_random"}. [근거: workers/api-gateway/src/routes/user.ts | toSessionResponse/create]
- 트랜잭션 경계: 단일 insert. 멱등성: client idempotency key 없음; 중복 호출은 여러 active session을 만들 수 있다. 운영상 허용하려면 fingerprint당 active session cap/cleanup이 필요하다. [근거: workers/migrations/0018_user_fingerprints.sql | idx_user_sessions_fingerprint] [미확인: idempotency key 미탐지]
- 실패 모드: migration 누락, insert failure, malformed body, fingerprint 부재. 보안 포인트: token DB plaintext 저장 제거. [근거: workers/migrations/0031_user_session_token_hash.sql]

## Endpoint: GET /api/v1/user/session/verify
- 목적: header/body에 제시된 session token의 active/expiry 검증. 입력 계약: Authorization Bearer 또는 session header. 출력 계약: active session DTO. [근거: workers/api-gateway/src/routes/user.ts | verify | line 316-329]
- 처리 단계: token 추출 -> hash lookup + legacy fallback -> expires_at datetime(now) 조건 -> touch last_activity -> response uses presented token. [근거: workers/api-gateway/src/routes/user.ts | findActiveSessionByToken/touchSessionActivity | line 91-107, 151-157]
- 실패 모드: missing token 401/400 계열, inactive/expired 404, DB column missing. 중복 요청은 read/touch이므로 대체로 안전하지만 last_activity write amplification 가능. [근거: workers/api-gateway/src/routes/user.ts | line 316-329]

## Endpoint: POST /api/v1/user/session/recover
- 목적: 기존 active session token을 새 session token으로 rotate. 입력 계약: old token. 출력 계약: new session token. [근거: workers/api-gateway/src/routes/user.ts | recoverSessionByToken | line 173-213]
- 상태 변화: old ACTIVE -> inactive, new ACTIVE row insert. 조건부 deactivate가 실패하면 복구를 중단한다. [근거: workers/api-gateway/src/routes/user.ts | deactivateSessionIfActive | line 135-147, 182-186]
- 중복요청 처리: old token replay는 findRecoverableSessionByToken(active only)에서 찾지 못하거나 deactivate changes=0으로 실패한다. [근거: workers/api-gateway/test/user-session-contract.test.ts | replay test] [근거: workers/api-gateway/src/routes/user.ts | line 114-147]
- 남은 위험: update와 insert가 하나의 명시 transaction으로 묶였는지는 확인되지 않았다. partial failure 시 old revoked/new missing 사고가 가능하다. [추정: transaction wrapper 미탐지]

## Endpoint: GET/POST /api/v1/user/session/:token* legacy URL routes
- 목적: 기존 URL token route 폐기. 입력 계약: path token이 들어오더라도 사용하지 않음. 출력 계약: 410 + DEPRECATED_SESSION_TOKEN_IN_URL. [근거: workers/api-gateway/src/routes/user.ts | line 336-365]
- 보안 포인트: URL path token leak를 중단한다. 운영 포인트: 410 hit count로 old client migration 상태를 추적해야 한다.

## Endpoint: POST /api/v1/auth/refresh
- 목적: refresh token rotation. 입력: refresh JWT. 출력: new access/refresh token. 상태: KV refresh token record/family. [근거: workers/api-gateway/src/routes/auth.ts | line 730-798]
- 실패 모드: token family missing/revoked, jti record missing, concurrent refresh replay, KV propagation delay. 멱등성: 보장 미흡. 권장: D1/DO compare-and-swap token family store.

## Endpoint: POST /api/v1/images/upload-direct / chat-upload
- 목적: admin/auth image upload to R2. 입력: multipart File, postId, metadata. 출력: key/url. 상태: R2 object. [근거: workers/api-gateway/src/routes/images.ts | line 123-291]
- 실패 모드: large file memory pressure, content-type spoofing, key traversal은 sanitized filename으로 일부 완화되지만 magic-byte 검증은 미확인. 권장: streaming/magic-byte/private prefix/orphan cleanup.

## Endpoint: Worker catch-all backend proxy
- 목적: Worker-owned가 아닌 allowed backend boundary를 Express backend로 proxy. 입력: original method/path/body/headers. 출력: backend response. [근거: workers/api-gateway/src/index.ts | proxyToBackend/app.all | line 36-179, 274-276]
- 보안 포인트: X-Backend-Key injection, canProxyPath gate. 위험: shared boundary drift와 route shadowing. 권장: endpoint map snapshot CI fail.

# 6. 서비스별 상태/불변식/전이 상세 분석
## 서비스명: User Session Service / user_sessions
- 역할: 익명 fingerprint session 생성, 검증, 복구, preference 연결. 호출자: Worker user route, backend mirror route, D1 adapter. [근거: workers/api-gateway/src/routes/user.ts] [근거: backend/src/routes/user.js] [근거: backend/src/adapters/session/d1-session-token-store.adapter.js]
- 상태: user_sessions.id, fingerprint_id, session_token marker, session_token_hash, is_active, expires_at, last_activity_at. 저장 위치: D1/SQLite user_sessions. [근거: workers/migrations/0018_user_fingerprints.sql | line 24-43] [근거: workers/migrations/0031_user_session_token_hash.sql]
상태 전이표 | 트리거 | 가드 | 실행 로직 | 전이 후 상태 | 실패 시 상태 | 근거
ABSENT->ACTIVE | POST /session | valid fingerprint/body | insert marker+hash row | active session | no row | [근거: workers/api-gateway/src/routes/user.ts | line 274-305]
ACTIVE->VERIFIED | GET /session/verify | hash/legacy match, is_active=1, expires_at>now | touch last_activity | active session | unchanged | [근거: workers/api-gateway/src/routes/user.ts | line 91-157, 316-329]
ACTIVE->REVOKED+NEW_ACTIVE | POST /session/recover | old active token | conditional deactivate + insert new | old inactive, new active | risk old inactive/new missing if insert fail | [근거: workers/api-gateway/src/routes/user.ts | line 173-213]
ANY->NOOP/410 | legacy URL route | path token present | return deprecated error | unchanged | unchanged | [근거: workers/api-gateway/src/routes/user.ts | line 336-365]
- 불변식(pre): presented token은 URL path가 아니라 Authorization/body/header에서만 받아야 한다. 보장: legacy URL route 410. 실패 시: token log leak. 테스트: user-session-contract 410 case. [근거: workers/api-gateway/test/user-session-contract.test.ts]
- 불변식(post): DB에는 raw session token이 저장되지 않아야 한다. 보장: hash+marker insert. 실패 가능: legacy plaintext row fallback은 migration 기간만 허용. [근거: workers/api-gateway/src/routes/user.ts | line 35-44, 284-293]
- 불변식(temporal): expired/inactive session은 verify/recover되어선 안 된다. 보장: is_active=1 and datetime(expires_at)>datetime(now). [근거: workers/api-gateway/src/routes/user.ts | line 99-107]
- 불변식(retry): old token recover는 한 번만 성공해야 한다. 보장: findRecoverable active-only + conditional deactivate changes. [근거: workers/api-gateway/src/routes/user.ts | line 114-147]
- 설계 평가: session logic이 route file에 많이 존재하므로 Worker/backend mirror drift 위험이 있다. hash helper와 state machine을 shared module로 이동하는 구조 개선이 필요하다. [근거: workers/api-gateway/src/routes/user.ts + backend/src/routes/user.js 중복 구현]

## 서비스명: Auth Refresh/TOTP/OAuth Service
- 역할: OAuth state/handoff, TOTP setup/challenge, refresh token rotation. 호출자: /auth/* routes. 상태 저장 위치: KV. [근거: workers/api-gateway/src/routes/auth.ts | line 156-212, 262-268, 424-467, 730-798]
- 상태: OAUTH_STATE, OAUTH_HANDOFF, REFRESH_FAMILY, REFRESH_TOKEN, TOTP_SETUP, TOTP_SECRET, TOTP_LAST_STEP, TOTP_CHALLENGE.
- 전이: refresh token ACTIVE -> CONSUMED/ROTATED -> NEW_ACTIVE; TOTP challenge ISSUED -> CONSUMED -> TOKEN_ISSUED. 가드: token validity, family not revoked, code valid. [근거: workers/api-gateway/src/routes/auth.ts | refresh/TOTP blocks]
- 불변식: refresh jti one-time use, token family revoke cascades, TOTP challenge one-time use, TOTP step replay 금지, OAuth state one-time use. 보장 실패 가능: KV get/delete/put 비원자성. 사고: replay login, session fixation, double refresh. 관련 테스트: [미확인: concurrency/replay integration test 미탐지].
- 운영 경고: KV를 강한 state machine 저장소로 쓰는 지점은 DO/D1 transaction으로 대체해야 한다.

## 서비스명: Comment/Reactions Service
- 역할: public comment/reaction CRUD, SSE stream, admin delete. 상태: comments/reactions DB rows, stream event state. [근거: workers/api-gateway/src/routes/comments.ts | line 176-547]
- 불변식: postId normalization 후 존재하는 post에만 comment 생성, same actor duplicate reaction 방지, admin delete 후 stream/history consistency. 보장 방식은 route query에 의존하며 unique constraint/transaction은 별도 확인 필요. [미확인: reaction unique index/transaction test]
- 실패 조건: duplicate reaction race, delete vs stream race, abusive public writes, stale post identifier.

## 서비스명: Image/R2 Upload Service
- 역할: admin image upload/presign/upload-direct, auth chat upload, admin delete. 상태: R2 object, generated key, KV rate count for chat upload. [근거: workers/api-gateway/src/routes/images.ts | line 80-300]
- 불변식: admin-only blog upload, auth-only chat upload, key must be sanitized, object delete must not delete arbitrary prefix. 보장: requireAdmin/requireAuth, filename sanitization. 실패 가능: magic-byte mismatch, key prefix permission leakage, oversized multipart memory. [근거: workers/api-gateway/src/routes/images.ts | line 80-300]

## 서비스명: AI Gateway Service
- 역할: public generation/summarization/vision/artifact read. 상태: mostly external provider cost/latency and artifacts. [근거: workers/api-gateway/src/routes/ai.ts | line 16-299]
- 불변식: provider timeout should not exhaust worker/backend, public calls must be quota-limited, artifact read must not expose unauthorized files. 보장: [미확인: centralized quota/circuit breaker not found in scanned blocks].

## 서비스명: Analytics/Secrets Expiry Services
- 역할: session/secret expiry based read/write. 상태: analytics sessions/secrets with expires_at. [근거: workers/api-gateway/src/routes/analytics.ts] [근거: backend/src/routes/analytics.js] [근거: workers/api-gateway/src/routes/secrets.ts]
- 불변식: ISO timestamp with T/Z must compare by actual datetime, not lexicographic mismatch. 패치: datetime(expires_at) comparisons. [근거: 해당 파일 datetime(expires_at) 변경]

## 서비스명: Backend Proxy/Internal Key Boundary
- 역할: Worker->backend internal authentication and internal route authorization. 상태: env BACKEND_API_KEY/INTERNAL_KEY. [근거: workers/api-gateway/src/index.ts | proxyToBackend] [근거: workers/api-gateway/src/routes/internal.ts | internal.use]
- 불변식: backend-only route는 direct public access 불가, internal route는 every handler before authz pass. 패치: internal.use 전역 미들웨어 + timing-safe hash comparison. [근거: workers/api-gateway/src/routes/internal.ts | line 43-76]

# 7. 아키텍처 평가
- 실제 아키텍처 스타일 정의: “Hybrid edge gateway + modular monolith backend + shared boundary contract”다. Worker가 일부 domain write를 직접 처리하고, backend도 같은 namespace의 일부 route를 처리하므로 순수 Hexagonal/Clean은 아니다. [근거: workers/api-gateway/src/routes/registry.ts] [근거: backend/src/routes/registry.js] [근거: shared/src/contracts/service-boundaries.js]
- 의도 vs 실제 차이: shared boundary contract와 governance scripts는 의도된 경계 관리를 보여주지만, route 파일 내부에 persistence query/state transition/security guard가 섞여 controller/service/repository 경계가 얇다. [근거: workers/api-gateway/src/routes/user.ts | hash/query/route in one file] [근거: workers/api-gateway/src/routes/auth.ts | KV state machine in route file]
- 경계 붕괴 지점: User session logic이 Worker route, backend route, backend adapter에 중복되어 drift 위험이 있다. 패치도 세 곳을 모두 수정해야 했다. [근거: workers/api-gateway/src/routes/user.ts] [근거: backend/src/routes/user.js] [근거: backend/src/adapters/session/d1-session-token-store.adapter.js]
- 책임 누수: route layer가 token hashing, DB query, state transition, response DTO를 함께 담당한다. 장기적으로 UserSessionStateMachine/TokenStore interface로 분리해야 한다. [근거: workers/api-gateway/src/routes/user.ts | line 35-213]
- 결합도/응집도: Worker index는 proxy/header/security/scheduled cron을 함께 가진다. 운영상 영향 범위가 크므로 route registry/proxy policy/scheduler를 별도 module로 더 분리하면 blast radius가 낮아진다. [근거: workers/api-gateway/src/index.ts | line 36-348]
- 숨겨진 의존성: URL path와 shared boundary, backend key env, KV naming convention이 contract로 동작한다. CI snapshot 없이는 drift 탐지가 어렵다. [근거: package.json | routes:check/contracts scripts]
- 순환 의존 가능성: scanned source만으로 실제 import cycle은 확정하지 못했다. [미확인: tsc/madge 미실행, node_modules/typecheck 부재]
- 데이터 계약 일관성: session response는 raw token 반환이 필요하지만 DB 저장은 hash/marker여야 한다. 패치 전후 mismatch를 test로 고정했다. [근거: workers/api-gateway/test/user-session-contract.test.ts]
- 유지보수 리스크: Worker/backend mirror route가 존재하는 영역은 한쪽만 패치될 가능성이 크다. shared contract + contract test 강화가 필요하다.

# 8. 운영/관리 방안 평가
## 설정/환경/시크릿 관리
- 현재 상태: backend .env/dotenv, Worker env vars/BACKEND_API_KEY/INTERNAL_KEY, package scripts/wrangler deploy가 존재한다. [근거: backend/package.json] [근거: workers/api-gateway/package.json] [근거: workers/api-gateway/src/index.ts | env key usage]
- 문제점: 원본에 .data/blog.db*가 포함되어 있었고, secret rotation/runbook은 확인되지 않았다. [근거: 원본 압축 해제] [미확인: rotation policy]
- 권장 관리 방안: secret은 Cloudflare secrets/K8s sealed secret로 관리, .env/.data 빌드/깃 제외, rotation metric과 dual-key grace period 도입. 우선순위: High.

## 인증/인가/세션/토큰 보안
- 현재 상태: backend key, Worker admin/auth middleware, JWT verification, session route가 존재한다. 패치로 URL session token route 폐기, hash 저장, timing-safe key/signature 비교를 적용했다. [근거: workers/api-gateway/src/routes/user.ts] [근거: workers/api-gateway/src/lib/jwt.ts] [근거: workers/r2-gateway/src/index.ts]
- 문제점: refresh/TOTP one-time use는 KV 비원자성 때문에 race에 취약할 수 있다. public AI/comment write endpoint abuse control도 추가 확인 필요. 우선순위: Critical/High.
- 권장: token family를 D1/DO transaction으로 이동, admin scopes 명시, CSRF/CORS strict allowlist, audit log, deprecated route hit alert.

## 데이터 정합성/트랜잭션
- 현재 상태: D1 query 중심. session recovery는 conditional update + insert지만 명시 transaction은 미확인. [근거: workers/api-gateway/src/routes/user.ts | line 173-213]
- 문제점: multi-step write partial failure, duplicate event/write, ISO datetime mismatch가 있었다. 일부 datetime mismatch는 패치했다. 우선순위: High.
- 권장: D1 transaction/batch where supported, idempotency keys, outbox/inbox for async side effects, migration preflight.

## 캐시/큐/이벤트 관리
- 현재 상태: KV를 auth state/cache/rate count에 사용한다. scheduled cron도 Worker에 존재한다. [근거: workers/api-gateway/src/index.ts | scheduled | line 284-348] [근거: workers/api-gateway/src/routes/auth.ts | KV]
- 문제점: KV stale/read-after-write/ordering assumptions. DLQ/replay/idempotency 확인 불가. 우선순위: High.
- 권장: replay-safe consumer contract, poison message 처리, KV는 cache로 제한하고 state transition은 transactional store로 이전.

## 파일/스트리밍/대용량 처리
- 현재 상태: R2 upload/direct/chat upload/delete route가 존재한다. [근거: workers/api-gateway/src/routes/images.ts | line 80-300]
- 문제점: magic byte validation, stream backpressure, private signed URL permission, orphan cleanup 미확인. 우선순위: High.
- 권장: max size gate before buffering, streaming upload, content sniffing, malware scanning where needed, object lifecycle cleanup.

## 관측성/장애 대응
- 현재 상태: health/readiness/metrics endpoint가 있다. [근거: backend/src/index.js | line 85-115] Worker health/status routes도 존재한다. [근거: endpoint-map-full.csv]
- 문제점: request correlation id, invariant metrics, deprecated route hit, token replay, AI quota, upload failure 등 핵심 metric 미확인. 우선순위: High.
- 권장: structured log with request_id/user/session_hash_prefix, SLO dashboard, alert for invariant violations, runbook links.

## 배포/릴리즈/롤백
- 현재 상태: wrangler deploy scripts, migrations apply scripts, k3s manifests가 있다. [근거: workers/api-gateway/package.json | deploy/migrations scripts] [근거: k3s/*]
- 문제점: migration sequencing/rollback safety/blue-green evidence 미확인. 0031 migration은 patched code와 함께 배포되어야 한다. 우선순위: High.
- 권장: expand/contract migration, canary, route snapshot CI, rollback은 patched code 계열만 허용 because old code cannot verify hash-only rows.

## 스케일/성능/비용
- 현재 상태: AI generation/stream, image upload, comments SSE 등 cost/latency hot path가 있다. [근거: workers/api-gateway/src/routes/ai.ts] [근거: workers/api-gateway/src/routes/images.ts] [근거: workers/api-gateway/src/routes/comments.ts]
- 문제점: public AI cost spike, SSE connection count, R2 upload bandwidth, DB hot index/session touch write amplification. 우선순위: Medium/High.
- 권장: per-IP/user budgets, token bucket, connection limits, backpressure, cost metric by provider/model, N+1 query profiling.

# 9. 테스트 공백 및 검증 계획
- 현재 테스트 보장 범위: backend readiness degraded path는 node --test로 통과했다. session contract test는 리팩토링 후 URL token 410, canonical verify, recover replay를 명시하도록 갱신했다. [근거: validation.log] [근거: workers/api-gateway/test/user-session-contract.test.ts]
- 현재 검증 제한: container에는 node_modules가 없고 Node v18.19.0인데 backend는 engines node >=20.0.0을 요구한다. worker vitest/typecheck/wrangler test는 실행하지 못했다. [근거: backend/package.json | engines] [근거: validation.log]
- 놓친 불변식: refresh token one-time-use concurrency, TOTP challenge double consume, session recover update+insert atomicity, image magic-byte validation, comment duplicate reaction race, backend proxy boundary drift, AI quota/circuit breaker, migration rollback compatibility.
우선순위 | 추가 테스트 | 수준 | 보장하려는 불변식 | 근거
Critical | user session migration + legacy plaintext fallback + hash-only row verify/recover | integration/contract | raw token not stored, legacy migration works | [근거: workers/migrations/0031_user_session_token_hash.sql]
Critical | concurrent POST /session/recover same old token x2 | integration/concurrency | old token recover exactly once | [근거: workers/api-gateway/src/routes/user.ts | conditional deactivate]
High | refresh token concurrent replay | integration/chaos | refresh jti one-time use | [근거: workers/api-gateway/src/routes/auth.ts | refresh KV]
High | TOTP challenge double verify | integration/concurrency | challenge one-time use | [근거: workers/api-gateway/src/routes/auth.ts | challenge KV get/delete]
High | route governance snapshot for all 370 endpoints | contract/CI | no accidental public route/proxy leak | [근거: endpoint-map-full.csv]
High | image upload polyglot/oversize/path traversal | security/e2e | file safety and prefix isolation | [근거: workers/api-gateway/src/routes/images.ts]
Medium | analytics/secrets expiry around timezone/T/Z | unit/integration | datetime comparison correctness | [근거: patched datetime(expires_at)]
Medium | public AI quota and provider timeout | load/contract | cost and latency bounded | [근거: workers/api-gateway/src/routes/ai.ts]
Medium | comment duplicate reaction race | integration/concurrency | unique reaction invariant | [근거: workers/api-gateway/src/routes/comments.ts]

# 10. 위험도 매트릭스
심각도 | 문제 | 위치 | 깨지는 불변식 | 사고 시나리오 | 탐지 난이도 | 수정 난이도 | 권장 조치 | 근거
Critical | URL path session token 노출 | workers/api-gateway/src/routes/user.ts legacy routes | token must not cross URL/log boundary | access log/referrer/history로 session 탈취 | 중간 | 낮음(패치 완료) | 410 폐기 + hit alert | [근거: line 336-365]
Critical | DB raw session token 저장 | user_sessions insert/lookup | raw secret not persisted | DB 유출 시 session 탈취 | 높음 | 중간(패치 완료+마이그레이션 필요) | hash/marker 저장, 0031 적용 | [근거: 0031 migration, user.ts line 35-44]
High | session recover partial failure | recover update+insert | recover atomicity | old inactive/new missing으로 사용자 세션 손실 | 중간 | 중간 | D1 transaction/batch + compensating test | [근거: user.ts line 173-213]
High | refresh/TOTP KV race | auth.ts | one-time token/challenge | concurrent replay로 중복 인증 | 높음 | 높음 | Durable Object/D1 CAS | [근거: auth.ts KV get/delete/put]
High | public AI cost abuse | ai.ts public POST/stream | public cost bounded | bot traffic으로 provider 비용 폭증 | 중간 | 중간 | quota/rate limit/circuit breaker | [근거: ai.ts line 74-248]
High | image upload validation gap | images.ts | uploaded content matches policy | malicious/polyglot/oversize object 저장 | 중간 | 중간 | magic byte/size/stream/private prefix | [근거: images.ts line 80-300]
High | backend proxy boundary drift | api-gateway index + shared boundaries | only allowed backend paths proxied | backend-only/admin endpoint 우발 노출 또는 route shadowing | 낮음 | 중간 | route snapshot CI, deny by default | [근거: index.ts line 36-179, shared boundaries]
Medium | ISO datetime lexicographic mismatch | analytics/secrets | expiry is actual time | expired session/secret incorrectly active/inactive | 중간 | 낮음(패치 완료) | datetime() comparison tests | [근거: patched files]
Medium | local DB artifact leakage | original .data/blog.db* | prod artifacts exclude local state | DB/PII/secrets가 archive/image에 포함 | 낮음 | 낮음(패치 완료) | .gitignore/.dockerignore + CI scan | [근거: .gitignore/.dockerignore]
Medium | insufficient invariant observability | health/metrics only | violations detected quickly | replay/abuse/cache stale가 늦게 발견 | 높음 | 중간 | invariant metrics/alerts | [근거: backend/src/index.js metrics, 미확인 invariant metric]

# 11. 구체적 개선안
## 11-A. 최소 침습 개선안
### 1. 0031 migration 적용 및 session contract CI 고정
- 해결하려는 문제: raw session token 저장/URL token leak/recover replay. 변경 위치: workers/migrations/0031_user_session_token_hash.sql, user.ts, backend user.js, adapter, user-session-contract.test.ts. 예상 효과: DB 유출 피해 축소, URL leak 차단, old token 재사용 차단. 리스크: migration 미적용 환경에서 column error. 선행 조건: staging D1 backup. 적용 순서: migration apply -> canary -> verify/recover tests -> prod. 검증: hash-only row verify, legacy plaintext fallback, deprecated route 410. [근거: 해당 파일들]
### 2. Deprecated URL session endpoint hit alert
- 해결하려는 문제: old client가 token URL을 계속 사용하면 보안 risk가 남음. 변경 위치: workers/api-gateway/src/routes/user.ts deprecated route. 예상 효과: client migration 상태 가시화. 리스크: metric cardinality; token 값은 절대 로깅 금지. 검증: 410 count only, no path token log. [근거: user.ts line 336-365]
### 3. Refresh/TOTP race test 추가
- 해결하려는 문제: KV one-time state race. 변경 위치: workers/api-gateway/test/auth-*.test.ts. 예상 효과: 현재 취약성을 재현 가능하게 만들고 구조 개선 전 임시 guard 설계 가능. 리스크: Cloudflare KV test harness 필요. 검증: concurrent refresh/challenge 2회 중 1회만 success. [근거: auth.ts line 424-798]
### 4. Public AI/comment/image mutation rate budget
- 해결하려는 문제: 비용/abuse 폭증. 변경 위치: ai.ts, comments.ts, images.ts, middleware. 예상 효과: provider/R2/DB 비용 제한. 리스크: 정상 사용자 false positive. 검증: load test, quota exhausted response. [근거: endpoint-map-full.csv public write rows]
### 5. Upload hardening patch
- 해결하려는 문제: content spoof/oversize/orphan. 변경 위치: images.ts. 예상 효과: malicious file 저장 방지. 리스크: 일부 legitimate file 차단. 검증: magic-byte mismatch/oversize/path traversal e2e. [근거: images.ts line 80-300]
### 6. Route governance CI
- 해결하려는 문제: Worker/backend boundary drift. 변경 위치: scripts/check-route-governance.mjs, docs/generated/audit/endpoint-map-full.csv snapshot. 예상 효과: 우발 public route/삭제 route 감지. 리스크: snapshot 관리 부담. 검증: route diff CI fail. [근거: package.json routes scripts]

## 11-B. 구조적 개선안
### 1. UserSessionStateMachine + TokenStore 분리
- 해결하려는 문제: Worker/backend/adapter 중복 구현. 변경 위치: shared/src/session 또는 workers/api-gateway/src/domain/session + backend adapter. 예상 효과: 상태 전이/불변식 중앙화, drift 감소. 리스크: shared package dependency/Cloudflare compatibility. 선행 조건: current contract tests. 적용 순서: interface 정의 -> Worker route delegate -> backend route delegate -> tests. 검증: 동일 fixture로 Worker/backend pass. [근거: user.ts/backend user.js/adapter 중복]
### 2. Auth one-time state를 Durable Object 또는 D1 transaction으로 이전
- 해결하려는 문제: KV CAS 부재. 변경 위치: auth.ts, new TokenFamilyStore. 예상 효과: refresh/TOTP exactly-once에 가까운 one-time consumption. 리스크: migration of existing refresh tokens. 검증: concurrent replay tests, forced stale read tests. [근거: auth.ts KV mutation]
### 3. Explicit API Contract/DTO schema layer
- 해결하려는 문제: route-local validation/response drift. 변경 위치: shared/contracts/api schemas, route validators. 예상 효과: frontend/backend/Worker response consistency. 리스크: migration work. 검증: schema snapshot, contract test. [근거: endpoint-map-full.csv output/DTO 다양]
### 4. Outbox/inbox for async side effects
- 해결하려는 문제: scheduled cron/event/external call partial failure. 변경 위치: worker scheduled jobs, backend workers, DB migrations. 예상 효과: replay-safe processing and idempotency. 리스크: operational complexity. 검증: duplicate/replay tests. [근거: workers/api-gateway/src/index.ts scheduled]
### 5. Observability architecture
- 해결하려는 문제: invariant violation detection gap. 변경 위치: middleware/logging/metrics. 예상 효과: request trace, session recover failure, refresh replay, AI cost spike, upload rejection alert. 리스크: PII leakage if badly designed. 검증: no-token log tests, metric cardinality review. [근거: health/metrics only + 미확인 invariant metric]

# 12. 실행 우선순위 로드맵
## 24시간 내 조치
- 0031_user_session_token_hash migration staging 적용 및 backup 확보. [근거: workers/migrations/0031_user_session_token_hash.sql]
- deprecated URL token endpoint 410 배포와 no-token logging 확인. [근거: workers/api-gateway/src/routes/user.ts line 336-365]
- .data/blog.db* 및 WAL/SHM이 repository/build context에 포함되지 않는지 CI secret/artifact scan. [근거: .gitignore/.dockerignore]
- Node 20 환경에서 npm ci 후 worker vitest/typecheck/backend tests 실행. [근거: backend/package.json engines, workers/api-gateway/package.json scripts]

## 1주 내 조치
- session recover concurrency/integration tests 추가.
- refresh/TOTP replay concurrency tests 추가.
- public AI/comment/image mutation quota와 alert 추가.
- route governance snapshot을 CI 필수 단계로 설정.

## 1~2스프린트 조치
- UserSessionStateMachine/TokenStore 공통화.
- Auth one-time state store를 DO/D1 transaction으로 이전.
- Upload streaming/magic-byte/signed URL/private prefix 정리.
- observability: request id, trace propagation, invariant metrics, runbook links.

## 구조 개편 과제
- Worker/backend boundary ownership 재정의 및 endpoint contract generation.
- route-local business logic을 service/usecase/domain layer로 분리.
- outbox/inbox/replay-safe background job contract 도입.

## 운영 runbook/모니터링/알람 추가 과제
- Alert: deprecated session URL hit > 0, recover deactivate changes=0 spike, refresh replay, TOTP double challenge, AI cost per hour, R2 upload rejection, readiness degraded, backend proxy 401/403/5xx.
- Runbook: migration rollback, secret rotation, KV incident, R2 orphan cleanup, AI provider outage, D1 schema drift.

# 13. 최종 판정
- 현재 수준 판정: 원본은 route/boundary governance 흔적은 있으나 세션 토큰 저장/URL 노출, KV one-time state, public mutation abuse, 로컬 DB artifact leakage 때문에 production hardening이 필요한 상태였다. 적용본은 가장 직접적인 세션/토큰/유출 위험을 줄였지만, full CI와 transactional auth state 개선 전에는 “제한적 canary 배포 가능” 수준으로 판정한다. [근거: refactor.diff] [근거: validation.log]
- 프로덕션 투입 가능 여부: 조건부. 필수 조건은 0031 migration, Node 20 full tests, worker vitest/typecheck, canary with observability, deprecated URL route 410 monitoring이다. [근거: workers/migrations/0031_user_session_token_hash.sql] [근거: backend/package.json engines]
- 반드시 해결해야 하는 블로커: migration 미적용, refresh/TOTP race test 부재, full dependency/typecheck 미수행, upload hardening 미확인, public AI quota 미확인.
- 모니터링 하에 허용 가능한 리스크: legacy plaintext session fallback은 migration 기간에만 허용 가능하다. fallback hit count가 0에 가까워지면 plaintext lookup 제거/old rows backfill을 진행해야 한다. [근거: workers/api-gateway/src/routes/user.ts | legacy fallback query]
- 추가 확인 필요 항목: 실제 Cloudflare env/secret 설정, D1 production schema, CI/CD pipeline, wrangler deployment state, Redis/Postgres production topology, frontend data fetching/cache invalidation, queue/DLQ presence, external provider timeout policy. [미확인: 업로드 파일 내 실행 환경/secret/CI 로그 부재]
- 근거: 본 보고서 #2 evidence ledger, #3 endpoint map, docs/generated/audit/refactor.diff, validation.log.
