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
- `GET /api/v1/public/config`
- `GET /metrics`
- `/api/v1/notifications`

이후 `app.use(requireBackendKey)`가 등록되므로, 나머지 mounted routes는 backend-to-backend key 전제를 가집니다.

### Guarded route mounts

- `/api/v1/ai`
- `/api/v1/comments`
- `/api/v1/analytics`
- `/api/v1/chat`
- `/api/v1/translate`
- `/api/v1/memos`
- `/api/v1/user-content`
- `/api/v1/og`
- `/api/v1/admin`
- `/api/v1/posts`
- `/api/v1/images`
- `/api/v1/auth`
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

## Verified Contracts

### Health and public config

- `GET /api/v1/healthz` -> `{ ok: true, env, uptime }`
- `GET /api/v1/public/config` -> `{ ok: true, data: publicRuntimeConfig() }`

### Metrics

파일: `backend/src/routes/metrics.js`

- endpoint: `GET /metrics`
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

```bash
# ============================================
# Server
# ============================================
APP_ENV=production              # development | staging | production
HOST=0.0.0.0
PORT=5080
TRUST_PROXY=1                   # Reverse proxy 앞에서 동작 시
ALLOWED_ORIGINS=https://blog.example.com,https://api.example.com

# ============================================
# AI - OpenAI-Compatible
# ============================================
AI_SERVER_URL=https://api.openai.com/v1
AI_API_KEY=your-api-key
OPENAI_API_KEY=optional-openai-key
AI_DEFAULT_MODEL=gpt-4.1

# ============================================
# Redis (비동기 작업 큐, 캐싱)
# ============================================
REDIS_URL=redis://redis:6379

# ============================================
# SQLite Database (Docker 환경)
# ============================================
SQLITE_PATH=/app/.data/blog.db
SQLITE_MIGRATIONS_DIR=/app/migrations

# ============================================
# RAG (선택)
# ============================================
AI_EMBEDDING_URL=https://api.openai.com/v1
AI_EMBEDDING_API_KEY=your-embedding-key
AI_EMBED_MODEL=text-embedding-3-small
CHROMA_URL=http://chromadb:8000
CHROMA_COLLECTION=blog-posts-all-MiniLM-L6-v2

# ============================================
# Admin Auth
# ============================================
ADMIN_BEARER_TOKEN=your-secure-token
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=12h

# ============================================
# Content Paths (Docker 환경)
# ============================================
CONTENT_PUBLIC_DIR=/frontend/public
CONTENT_POSTS_DIR=/frontend/public/posts
CONTENT_IMAGES_DIR=/frontend/public/images
POSTS_SOURCE=filesystem           # filesystem | github | r2

# ============================================
# GitHub Integration (선택)
# ============================================
GITHUB_TOKEN=ghp_...
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=blog

# ============================================
# Worker API (REQUIRED for AI dynamic config)
# ============================================
# ⚠️  WORKER_API_URL is required for centralized AI provider config.
# Without it, the backend falls back to local env vars for AI settings
# and multi-provider routing is unavailable.
WORKER_API_URL=https://api.example.com

# ============================================
# Consul Service Discovery (선택)
# ============================================
USE_CONSUL=false                  # true to enable Consul KV
CONSUL_HOST=consul
CONSUL_PORT=8500
```

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
curl http://localhost:5080/metrics
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
- 성공 후 출력되는 안내도 manual deployment 절차만 제공합니다.

`backend/AGENTS.md` 기준 운영 전제:

- 서버 owner가 `git pull && docker-compose up -d` 방식으로 서비스 재시작
- CI는 image publish까지만 담당

## Operations

### Quick checks

```bash
# backend process
curl http://localhost:5080/api/v1/healthz

# metrics
curl http://localhost:5080/metrics

# notifications subsystem health (requires backend key)
curl -H 'X-Backend-Key: <key>' http://localhost:5080/api/v1/notifications/health
```

### Failure modes

- Consul load 실패 또는 미구성 -> env fallback 전제
- PostgreSQL migration 실패 -> warning을 남기고 계속 부팅
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
