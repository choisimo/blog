# Backend API Server

> 참고: 이 문서의 공개 호스트명, 운영 주소, 이메일 예시는 모두 비식별 placeholder입니다.

## Service Overview

`backend/`는 Node.js Express origin server입니다. `api-gateway`가 처리하지 않는 API를 받거나, backend 전용 기능을 수행합니다.

- runtime: Node.js 20+
- framework: Express 4
- default port: `5080`
- scripts: `dev`, `start`, `worker`, `worker:dev`

## Startup Sequence

파일: `backend/src/index.js`

서버 시작 시 확인된 순서는 다음과 같습니다.

1. `loadAndApplyConsulConfig()` 호출
2. PostgreSQL이 설정되어 있으면 `runMigrations()` 시도
3. Express app 구성
4. route mount 및 middleware 등록
5. HTTP server listen
6. `initChatWebSocket(server)` 호출

종료 시에는 graceful shutdown을 수행하고 Redis close를 시도합니다. 강제 종료 타임아웃은 10초입니다.

## Route Boundary

backend의 중요한 경계는 `requireBackendKey` 적용 시점입니다.

### Public or pre-guard routes

- `GET /api/v1/healthz`
- `GET /api/v1/readiness`
- `GET /api/v1/public/config`
- `GET /metrics` (`requireBackendKey` is applied on the route mount itself)
- `/api/v1/auth` and `/api/v1/notifications` are mounted before the global guard but still require `X-Backend-Key` at the mount boundary.

이후 `app.use(requireBackendKey)`가 등록되므로, 나머지 mounted routes는 backend-to-backend key 전제를 가집니다.

### Guarded route mounts

- `/api/v1/ai`
- `/api/v1/analytics`
- `/api/v1/chat`
- `/api/v1/translate`
- `/api/v1/memos`
- `/api/v1/user-content`
- `/api/v1/og`
- `/api/v1/admin`
- `/api/v1/posts`
- `/api/v1/images`
- `/api/v1/rag`
- `/api/v1/memories`
- `/api/v1/user`
- `/api/v1/search`
- `/api/v1/admin/config`
- `/api/v1/admin/workers`
- `/api/v1/agent`
- `/api/v1/debate`
- `/api/v1/execute`

운영상 의미:

- frontend가 backend를 직접 두드리는 구조가 아니라면, 이 경계는 주로 `api-gateway` 또는 다른 내부 서비스 호출을 위한 것입니다.
- `X-Backend-Key`가 빠지면 guarded routes는 접근이 거부됩니다.
- 프로덕션에서는 backend origin을 public internet에 직접 노출하지 않고 Worker/firewall/mTLS/IP allowlist 뒤에 둡니다. process-local state 운영 제약은 [operational-state.md](/home/nodove/workspace/blog/docs/operational-state.md)를 기준으로 관리합니다.
- GitHub PR 생성, image vision, RAG Chroma index/delete, deploy hook, notification broadcast는 backend `domain_outbox` worker가 재시도하며 처리합니다. 수동 점검은 `/api/v1/admin/backend-outbox`, 수동 flush는 `/api/v1/admin/backend-outbox/flush`를 사용합니다.
- 댓글 surface는 backend legacy router를 제거하고 worker D1 경로만 authoritative surface로 유지합니다.

## Verified Contracts

### Health and public config

- `GET /api/v1/healthz` -> `{ ok: true, status, degraded, degradedReasons, env, uptime }`
- `GET /api/v1/readiness` -> `200 ready` 또는 `503 degraded`
- `GET /api/v1/public/config` -> `{ ok: true, data: publicRuntimeConfig() }`

### Metrics

파일: `backend/src/routes/metrics.js`

- endpoint: `GET /metrics`
- auth: `X-Backend-Key` required
- output: Prometheus metrics text
- behavior:
  - Redis 상태를 측정값으로 갱신
  - Redis가 살아 있으면 AI task queue 길이도 갱신 시도
  - queue stats 수집 실패는 metrics 응답 자체를 막지 않음

### Notifications

파일: `backend/src/routes/notifications.js`

- `GET /stream`
  - auth: `requireUserAuth`
  - transport: SSE
  - heartbeat: 25초 ping
- `POST /push`
  - auth: `requireBackendKey`
  - body: `title`, `message` 필수, `event`, `type`, `payload`, `userId`, `sourceId` 선택
- `GET /health`
  - auth: `requireBackendKey`
  - output: subscriber count

이 라우터는 `requireBackendKey`보다 먼저 mount되지만, 내부에서 각 endpoint별 auth를 다시 적용합니다.

## Architecture Notes

### Why this server still exists behind the worker

- worker는 edge에서 빠르게 처리 가능한 라우트와 public config를 직접 처리합니다.
- backend는 AI, chat, execute, RAG, image generation 같은 origin 의존 기능을 맡습니다.
- 결과적으로 route ownership이 worker와 backend 사이에 나뉘어 있으므로, 문서와 운영 도구는 어느 쪽이 authoritative handler인지 항상 확인해야 합니다.

### Trade-offs

- 장점: 무거운 연산과 장기 연결을 edge runtime 밖으로 분리할 수 있습니다.
- 단점: `api-gateway -> backend` hop, shared secret, route ownership 중복 관리가 필요합니다.
- 결과: health/debugging 시 worker health와 backend health를 분리해서 확인해야 합니다.

## Runtime Dependencies

`backend/package.json`과 mount code 기준 주요 의존성:

- Express, Helmet, Morgan, CORS, `express-rate-limit`
- Redis
- `prom-client`
- `better-sqlite3`
- `pg`
- `sharp`
- `openai`
- `ws`

설정/스토리지 관련 실제 경로 사용:

- `SQLITE_PATH`
- `SQLITE_MIGRATIONS_DIR`
- `CONTENT_PUBLIC_DIR`
- `CONTENT_POSTS_DIR`
- `CONTENT_IMAGES_DIR`

## Development

```bash
cd backend
npm ci
npm run dev
```

확인용 요청:

```bash
curl http://localhost:5080/api/v1/healthz
curl -H 'X-Backend-Key: <key>' http://localhost:5080/metrics
```

background worker:

```bash
cd backend
npm run worker
```

## Deployment

파일: `.github/workflows/deploy-blog-workflow.yml`

- trigger:
  - `workflow_dispatch`
  - `main` branch push with `backend/**`
  - workflow file 자체 변경
- workflow는 다음 이미지를 build/push 합니다.
  - `ghcr.io/<owner>/blog-api`
  - `ghcr.io/<owner>/blog-terminal`
- workflow는 서버에 SSH 배포를 수행하지 않습니다.
- production rollout model은 GitOps 기준입니다.
- Argo CD가 저장소의 `k3s` 경로를 감시하고, Argo CD Image Updater가 `blog-api`, `blog-terminal`의 immutable SHA tag를 선택한 뒤 auto-sync로 반영합니다.
- production 기준으로는 `git pull && docker-compose up -d` 같은 수동 origin 재시작 절차를 운영 기본값으로 두지 않습니다.
- `docker-compose`는 local/dev 실행 또는 ad-hoc origin debugging 문맥으로만 해석하는 편이 안전합니다.

## Operations

### Quick checks

```bash
# backend process
curl http://localhost:5080/api/v1/healthz

# metrics
curl -H 'X-Backend-Key: <key>' http://localhost:5080/metrics

# notifications subsystem health (requires backend key)
curl -H 'X-Backend-Key: <key>' http://localhost:5080/api/v1/notifications/health
```

### Failure modes

- Consul load 실패 또는 미구성 -> env fallback 전제
- PostgreSQL migration 실패 -> warning을 남기고 계속 부팅하지만 readiness는 degraded를 노출
- Redis close 실패 -> shutdown 시 error log
- missing `X-Backend-Key` -> guarded routes 접근 실패
- SSE subscriber 누적 -> notification stream 메모리 사용 증가 가능

## Directory Guide

```text
backend/
|- src/index.js
|- src/routes/
|- src/middleware/
|- src/services/
|- src/repositories/
|- src/workers/
|- terminal-server/
`- package.json
```

세부 구현은 `backend/AGENTS.md`와 각 route/service 파일을 함께 보는 것이 가장 안전합니다.
