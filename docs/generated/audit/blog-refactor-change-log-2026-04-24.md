# Blog 프로젝트 리팩토링 변경내역
- 산출일: 2026-04-24 KST
- 변경 범위: 세션 토큰 보안, URL 토큰 폐기, recovery replay 차단, internal/backend key timing-safe 비교, expiry datetime 비교, artifact leakage 방지, 테스트/endpoint map 문서화.

# 1. 적용된 주요 변경
## 1.1 세션 토큰 평문 저장 제거
- workers/migrations/0031_user_session_token_hash.sql 추가: session_token_hash 컬럼, unique index, active lookup index를 추가했다.
- workers/api-gateway/src/routes/user.ts: hashSessionToken/sessionTokenMarker를 도입하고 새 session row는 raw token 대신 marker+hash를 저장한다. [근거: user.ts line 35-44, 284-293]
- backend/src/routes/user.js 및 backend/src/adapters/session/d1-session-token-store.adapter.js도 같은 dual-read/hash 저장 계약으로 맞췄다.

## 1.2 URL token legacy route 폐기
- GET /api/v1/user/session/:token 및 POST /api/v1/user/session/:token/recover는 410 DEPRECATED_SESSION_TOKEN_IN_URL을 반환하도록 변경했다. [근거: user.ts line 336-365]
- token을 path에서 읽어 검증/복구하지 않기 때문에 access log/referrer/browser history 노출 경로를 차단한다.

## 1.3 Recovery replay 차단
- recoverSessionByToken은 active old session만 조회하고 deactivateSessionIfActive가 changes===1인 경우에만 new session을 만든다. [근거: user.ts line 114-147, 173-213]
- backend mirror route도 WHERE id=? AND is_active=1 조건부 update로 변경했다. [근거: backend/src/routes/user.js | deactivateSession]

## 1.4 Internal/backend key timing-safe 비교
- workers/api-gateway/src/routes/internal.ts: internal.use(*) 전역 middleware와 timing-safe hex 비교를 적용했다. [근거: internal.ts line 43-76]
- workers/api-gateway/src/lib/jwt.ts: JWT HMAC signature 비교를 constantTimeEqual로 변경했다. [근거: jwt.ts line 27-37, 95]
- workers/r2-gateway/src/index.ts: INTERNAL_KEY 비교를 timingSafeEqual로 변경했다. [근거: r2 index.ts line 90-104]

## 1.5 ISO datetime 비교 보정
- analytics/secrets expiry query에서 expires_at 문자열 직접 비교 대신 datetime(expires_at)와 datetime(now)를 사용하도록 변경했다.
- 변경 파일: backend/src/routes/analytics.js, workers/api-gateway/src/routes/analytics.ts, workers/api-gateway/src/routes/secrets.ts, workers/api-gateway/src/lib/secrets.ts.

## 1.6 로컬 DB/분석 산출물 유출 방지
- .gitignore 추가: .data, *.db, *.db-wal, *.db-shm, .env, build/cache/log 제외.
- .dockerignore 보강: .data, DB/WAL, .worktrees, evidence, test-results, playwright-report 제외.

## 1.7 테스트/문서 산출물
- workers/api-gateway/test/user-session-contract.test.ts 갱신: canonical verify, URL token 410, recover replay, old token invalidation, new token verify.
- docs/generated/audit/endpoint-map-full.csv: 370개 endpoint 15열 맵.
- docs/generated/audit/refactor.diff: 원본 대비 변경 diff.

# 2. 변경 파일 목록
- .dockerignore
- .gitignore
- backend/src/adapters/session/d1-session-token-store.adapter.js
- backend/src/routes/analytics.js
- backend/src/routes/user.js
- docs/generated/audit/endpoint-map-full.csv
- docs/generated/audit/endpoint-map.json
- docs/generated/audit/refactor.diff
- workers/api-gateway/src/lib/jwt.ts
- workers/api-gateway/src/lib/secrets.ts
- workers/api-gateway/src/routes/analytics.ts
- workers/api-gateway/src/routes/internal.ts
- workers/api-gateway/src/routes/secrets.ts
- workers/api-gateway/src/routes/user.ts
- workers/api-gateway/test/user-session-contract.test.ts
- workers/migrations/0031_user_session_token_hash.sql
- workers/r2-gateway/src/index.ts

# 3. 검증 결과
- node --check backend/src/routes/user.js: exit=0
- node --check backend/src/adapters/session/d1-session-token-store.adapter.js: exit=0
- node --check backend/src/routes/analytics.js: exit=0
- node --test backend/test/readiness.test.js: pass 1/1
- 전체 npm/vitest/typecheck: 미수행. container에 node_modules가 없고 Node v18.19.0이며 backend는 node >=20.0.0을 요구한다. [근거: validation.log, backend/package.json]

# 4. 배포 순서 권장안
1. staging D1 backup 및 0031 migration 적용.
2. Node 20에서 npm ci, worker vitest/typecheck, backend node --test, route governance check 실행.
3. canary로 Worker 배포. Deprecated URL session route 410 hit, session verify/recover error, backend proxy 401/403/5xx 모니터링.
4. prod migration + Worker/backend patched code 동시 배포.
5. legacy plaintext fallback hit count가 충분히 낮아지면 backfill 후 plaintext fallback 제거 계획 수립.

# 5. Rollback 주의사항
- 0031 적용 후 새 session row는 hash/marker 저장 방식이다. old code로 rollback하면 hash-only session 검증에 실패할 수 있다.
- rollback은 “patched code 이전 버전”이 아니라 “patched code 계열의 이전 release”로 제한해야 한다.
- migration 자체 rollback보다 dual-read fallback과 canary disable이 안전하다.

# 6. 남은 리스크
- Auth refresh/TOTP KV race는 아직 구조적으로 해결되지 않았다.
- AI/comment/image public mutation quota와 upload magic-byte 검증은 별도 hardening이 필요하다.
- full dependency 기반 typecheck/vitest가 아직 실행되지 않았다.
