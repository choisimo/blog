# Cloudflare Workers

> 참고: 이 문서의 공개 호스트명과 운영 주소 예시는 모두 비식별 placeholder입니다.

## Service Overview

`workers/`는 블로그의 edge layer입니다. 공통 특징은 다음과 같습니다.

- 구현: TypeScript
- runtime: Cloudflare Workers
- framework: Hono
- compatibility flag: 모든 worker가 `nodejs_compat` 사용
- data plane: D1, R2, KV, backend proxy

## Workers

| Worker | Verified name / route | Purpose | Verified boundary | Document |
| --- | --- | --- | --- | --- |
| `api-gateway` | worker name `blog-api-gateway` | `/api/v1/*`와 health/config 처리, backend fallback | 미처리 요청은 backend로 프록시 | `workers/api-gateway/README.md` |
| `r2-gateway` | worker name `r2-gateway` | R2 public/internal object access | `/internal/*`는 internal key 전제 | `workers/r2-gateway/README.md` |
| `terminal-gateway` | worker name `terminal-gateway` | backend terminal server WebSocket proxy | `/terminal` path만 허용 | `workers/terminal-gateway/README.md` |
| `seo-gateway` | worker name `seo-gateway` | crawler 대상 meta tag rewrite | non-crawler는 static path 흐름 유지 | `workers/seo-gateway/README.md` |

## API Gateway

파일: `workers/api-gateway/src/index.ts`

### Direct endpoints

- `GET /_health` -> `{ ok, worker, timestamp }`
- `GET /healthz` -> `{ ok, data: { status, env, timestamp } }`
- `GET /health` -> backend proxy
- `GET /public/config` -> public runtime config
- `GET /api/v1/public/config` -> same public runtime config

### Mounted route prefixes

`/api/v1` 아래에 다음 prefix가 등록됩니다.

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

### Fallback and proxy behavior

- `app.all('*', ...)`가 남은 요청을 backend로 전달합니다.
- backend origin이 없으면 500 JSON 오류를 반환합니다.
- backend request에는 `X-Backend-Key`, `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Real-IP`, `X-Request-ID`, `CF-Ray`, `CF-IPCountry`가 추가될 수 있습니다.
- backend가 `502`-`504`를 반환하면 worker가 `Retry-After: 30`을 포함한 JSON 응답으로 감싸서 반환합니다.

### Public config contract

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

### Scheduled job

- cron: `0 6 * * *`
- 동작:
  - `post_stats`의 `views_7d`, `views_30d` 갱신
  - `editor_picks` 재선정
  - `post_views`에서 90일 초과 데이터 삭제

## R2 Gateway

파일: `workers/r2-gateway/src/index.ts`

- public prefixes: `ai-chat/`, `images/`, `posts/`, `assets/`
- root endpoint는 `{ ok: true, service: "r2-gateway" }`를 반환합니다.
- internal API shape: `/internal/{resource}/{userId}/{id?}`
- caching:
  - immutable cache header 사용
  - ETag 기반 `304 Not Modified` 지원

운영상 가정:

- 공개 접근은 prefix 규칙에 의존합니다.
- internal 경로는 별도 내부 인증 헤더 구성이 필요합니다.

## Terminal Gateway

파일: `workers/terminal-gateway/src/index.ts`

- `GET /health` 제공
- `/terminal` WebSocket upgrade path만 처리
- JWT 검증 수행
- rate limiting 적용
- 사용자당 단일 세션을 강제
- geo blocking 적용
- backend origin으로 프록시할 때 `X-Backend-Key`를 주입

운영상 제약:

- 장기 연결은 backend terminal server 가용성에 직접 의존합니다.
- single-session 정책 때문에 중복 접속은 충돌 응답이 날 수 있습니다.

## SEO Gateway

파일: `workers/seo-gateway/src/index.ts`

- route: `noblog.nodove.com/*`
- crawler를 감지하면 raw GitHub 기반 `index.html`을 가져와 meta rewrite를 수행합니다.
- crawler가 아니면 static asset / GitHub Pages 흐름으로 pass-through 합니다.
- debug endpoint: `/api/seo-debug`

이 설계의 결과:

- 일반 사용자 요청은 기존 정적 사이트 흐름을 유지합니다.
- crawler 처리 품질은 upstream HTML fetch와 crawler detection 정확도에 좌우됩니다.

## Bindings And Config

주요 공통점:

- 각 worker의 `wrangler.toml`에 `compatibility_flags = ["nodejs_compat"]`
- secret은 `wrangler.toml`이 아니라 `wrangler secret put`으로 넣어야 합니다.

`workers/package.json` 기준 공용 스크립트:

```bash
npm run dev
npm run deploy
npm run deploy:prod
npm run migrations:apply
npm run migrations:apply:prod
npm run migrations:create
npm run d1:shell
npm run typecheck
npm run format
```

## D1 Migrations

파일 위치: `workers/migrations/`

- 확인된 범위: `0001_init.sql` -> `0023_openai_key_ownership.sql`
- 중간 migration은 config, AI model, agent orchestration, playground, fingerprints, debate, subscribers, secrets key standardization 등을 포함합니다.

적용 명령:

```bash
cd workers
npm run migrations:apply
npm run migrations:apply:prod
```

문서상 주의:

- production에 적용된 migration 파일은 수정하지 않는 전제가 `workers/AGENTS.md`에 명시되어 있습니다.

## Deployment

### Manual

```bash
cd workers
npm ci
npm run deploy:prod
```

개별 worker는 각 디렉토리에서 `wrangler deploy --env production`으로 배포할 수 있습니다.

### GitHub Actions

파일: `.github/workflows/deploy-workers.yml`

- trigger:
  - `workflow_dispatch`
  - `main` branch push with `workers/**`
  - workflow file 자체 변경
- 현재 workflow가 자동 배포하는 대상은 `workers/api-gateway`입니다.
- workflow는 `AI_DEFAULT_MODEL`, `AI_VISION_MODEL`, `PERPLEXITY_MODEL`, `API_BASE_URL`, `ASSETS_BASE_URL`, `ALLOWED_ORIGINS`를 non-empty일 때 production secret으로 주입합니다.

## Operations

### Quick checks

```bash
# api-gateway health
curl https://api.example.com/_health
curl https://api.example.com/healthz

# backend proxy check through api-gateway
curl https://api.example.com/health
```

### Failure modes

- backend origin 누락 -> api-gateway가 500 반환
- backend unavailable -> api-gateway가 503 또는 upstream 502-504 wrapped JSON 반환
- KV/session 불일치 -> terminal/auth flows에서 즉시성 문제 가능
- 잘못된 R2 key 또는 prefix -> 404
- crawler detection 오판 -> SEO meta rewrite 누락 가능

## Directory Layout

```text
workers/
|- api-gateway/
|- r2-gateway/
|- terminal-gateway/
|- seo-gateway/
|- migrations/
|- scripts/
|- package.json
`- worker-configuration.d.ts
```
