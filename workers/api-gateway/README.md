# Blog API Gateway

> 참고: 이 문서의 공개 호스트명과 운영 주소 예시는 모두 비식별 placeholder입니다.

## Service Overview

`workers/api-gateway/`는 edge의 주 API 진입점입니다.

- worker name: `blog-api-gateway`
- runtime: Cloudflare Workers
- framework: Hono
- entrypoint: `workers/api-gateway/src/index.ts`
- compatibility flag: `nodejs_compat`
- data dependencies: D1, R2, KV, backend proxy

## Direct Endpoints

파일: `workers/api-gateway/src/index.ts`

- `GET /_health` -> `{ ok: true, worker: "blog-api-gateway", timestamp }`
- `GET /healthz` -> `{ ok: true, data: { status: "ok", env, timestamp } }`
- `GET /health` -> backend proxy
- `GET /public/config` -> public runtime config
- `GET /api/v1/public/config` -> same public runtime config

## Mounted Route Prefixes

`/api/v1` 아래에 다음 prefix가 mount 됩니다.

```text
/auth
/posts
/comments
/ai
/chat
/images
/og
/analytics
/translate
/config
/rag
/memos
/memories
/admin/ai
/admin/secrets
/internal
/personas
/user-content
/search
/user
/debate
/subscribe
/contact
/notifications
/admin/logs
/gateway
```

이 문서는 각 prefix 내부의 세부 endpoint를 추측하지 않습니다. 실제 contract는 해당 route file과 tests가 있는 경우 그 구현을 기준으로 확인해야 합니다.

## Backend Fallback Contract

미처리 요청은 `app.all('*', ...)`로 backend에 전달됩니다.

- `BACKEND_ORIGIN`이 없으면 `500` JSON 오류 반환
- `BACKEND_KEY`가 있으면 `X-Backend-Key` 주입
- `GATEWAY_SIGNING_SECRET`이 있으면 `X-Gateway-*` HMAC origin signature 주입
- 추가 전달 가능 헤더:
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`
  - `X-Real-IP`
  - `X-Request-ID`
  - `CF-Ray`
  - `CF-IPCountry`
- `/api/v1/ai`, `/api/v1/chat`, `/api/v1/agent` 요청은 강제 모델 헤더를 붙일 수 있음
- `/api/v1/images` 또는 `/api/v1/ai/vision` 요청은 vision model 헤더를 붙일 수 있음
- backend가 `502`-`504`를 반환하면 worker는 JSON 오류와 `Retry-After: 30`을 반환
- backend fetch 자체 실패 시 `503`과 `Retry-After: 30` 반환

운영상 의미:

- worker health가 정상이어도 backend health는 별도로 깨질 수 있습니다.
- 장애 확인 시 `/_health`, `/healthz`, `/health`를 분리해서 보는 것이 안전합니다.

## Public Config Contract

파일: `workers/api-gateway/src/index.ts`

public config 응답에는 다음 필드가 포함됩니다.

- `env`
- `apiBaseUrl`
- `chatBaseUrl`
- `chatWsBaseUrl`
- `ai.modelSelectionEnabled`
- `ai.defaultModel`
- `ai.visionModel`
- `features.aiEnabled`
- `features.ragEnabled`
- `features.terminalEnabled`
- `features.aiInline`
- `features.commentsEnabled`

숨은 전제:

- `chatWsBaseUrl`은 `apiBaseUrl`을 `ws://` 또는 `wss://`로 치환해 계산합니다.
- feature flags는 현재 코드상 모두 `true`로 고정되어 있습니다.

## Scheduled Work

- cron: `0 6 * * *`
- 확인된 동작:
  - `post_stats`의 `views_7d`, `views_30d` 갱신
  - `editor_picks` 재선정
  - `post_views`의 90일 초과 데이터 삭제

이 job은 D1 binding `DB`를 전제로 합니다.

## Bindings And Config

파일: `workers/api-gateway/wrangler.toml`

- D1 binding: `DB`
- R2 binding: `R2`
- KV binding: `KV`
- dev vars:
  - `ENV = "development"`
  - `ALLOWED_ORIGINS`
  - `ASSETS_BASE_URL`
  - `API_BASE_URL`
- prod vars:
  - `ENV = "production"`
- cron configured in Wrangler
- observability enabled

문서상 경계:

- secret은 `wrangler.toml`에 넣지 않고 `wrangler secret put`으로 주입해야 합니다.
- production D1은 `blog-db-prod`, development D1은 `blog-db`를 사용합니다.

## Operations

### Quick checks

```bash
curl https://api.example.com/_health
curl https://api.example.com/healthz
curl https://api.example.com/health
curl https://api.example.com/public/config
```

### Failure modes

- `BACKEND_ORIGIN` 누락 -> fallback 경로에서 `500`
- backend 연결 실패 -> `503` + `Retry-After: 30`
- backend upstream `502`-`504` -> wrapped JSON 오류 응답
- 잘못된 runtime base URL config -> `public/config`의 API/WS endpoint가 잘못 계산될 수 있음

## Deployment

공용 스크립트는 `workers/package.json`에 있습니다.

```bash
cd workers
npm ci
npm run dev
npm run deploy:prod
```

GitHub Actions 파일: `.github/workflows/deploy-workers.yml`

- `workers/**` 변경 또는 수동 실행 시 동작
- 현재 자동 배포 대상은 `api-gateway`
- 일부 runtime config를 production secret으로 주입한 뒤 deploy 실행
