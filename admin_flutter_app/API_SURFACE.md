# 관리자 API 사용 범위

이 Flutter 앱은 업로드된 `blog-main` 저장소에서 확인한 현재 관리자 API와 React 관리자 화면을 기준으로 작성했습니다.

## 인증

- `GET /api/v1/auth/totp/status`
- `GET /api/v1/auth/totp/setup`
- `POST /api/v1/auth/totp/setup/verify`
- `POST /api/v1/auth/totp/challenge`
- `POST /api/v1/auth/totp/verify`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/oauth/handoff/consume`

## 시스템 상태

- `GET /api/v1/healthz`
- `GET /api/v1/rag/health`
- `GET /api/v1/agent/health`
- `GET /api/v1/admin/ai/providers`

## RAG

- `GET /api/v1/rag/collections`
- `GET /api/v1/rag/status`
- `POST /api/v1/rag/search`
- `POST /api/v1/rag/embed`
- `POST /api/v1/rag/index`
- `DELETE /api/v1/rag/index/:documentId`

## Analytics

- `GET /api/v1/analytics/trending`
- `GET /api/v1/analytics/editor-picks`
- `GET /api/v1/analytics/realtime`
- `POST /api/v1/analytics/refresh-stats`
- `GET /api/v1/admin/analytics/posts`
- `GET /api/v1/admin/analytics/posts/:year/:slug/metrics`
- `GET /api/v1/admin/analytics/posts/:year/:slug/visits`
- `POST /api/v1/analytics/admin/editor-picks`
- `PUT /api/v1/analytics/admin/editor-picks/:year/:slug`
- `DELETE /api/v1/analytics/admin/editor-picks/:year/:slug`

## Logs

- `GET /api/v1/admin/logs`
- `GET /api/v1/admin/logs/stream`

## Content

- `GET /api/v1/site-content/admin/:key`
- `PUT /api/v1/site-content/admin/:key`

## AI 관리

- `GET/POST/PUT/DELETE /api/v1/admin/ai/providers`
- `POST /api/v1/admin/ai/providers/:id/kill-switch`
- `POST /api/v1/admin/ai/providers/:id/enable`
- `GET/POST/PUT/DELETE /api/v1/admin/ai/models`
- `GET/POST/PUT/DELETE /api/v1/admin/ai/routes`
- `POST /api/v1/admin/ai/playground/run`
- `GET/DELETE /api/v1/admin/ai/playground/history`
- `GET/DELETE /api/v1/admin/ai/playground/history/:id`
- `GET /api/v1/admin/ai/usage`
- `GET /api/v1/admin/ai/config/export`
- `GET /api/v1/admin/ai/traces`
- `GET /api/v1/admin/ai/traces/:id`
- `GET /api/v1/admin/ai/traces/stats/summary`
- `GET/POST/PUT/DELETE /api/v1/admin/ai/prompt-templates`
- `POST /api/v1/admin/ai/prompt-templates/:id/use`
- `GET /api/v1/agent/prompts`
- `PUT/DELETE /api/v1/agent/prompts/:mode`

## Config

- `GET /api/v1/admin/config/categories`
- `GET /api/v1/admin/config/current`
- `POST /api/v1/admin/config/validate`
- `POST /api/v1/admin/config/export`
- `POST /api/v1/admin/config/save-env`
- `GET /api/v1/admin/config/schema`

## Secrets

- `GET /api/v1/admin/secrets/overview`
- `GET /api/v1/admin/secrets/health`
- `GET/POST /api/v1/admin/secrets`
- `GET/PUT/DELETE /api/v1/admin/secrets/:id`
- `POST /api/v1/admin/secrets/:id/reveal`
- `POST /api/v1/admin/secrets/generate`
- `GET/POST /api/v1/admin/secrets/categories`
- `GET /api/v1/admin/secrets/audit`
- `GET /api/v1/admin/secrets/export`
- `POST /api/v1/admin/secrets/import`

## Workers

- `GET /api/v1/admin/workers/list`
- `GET /api/v1/admin/workers/secrets`
- `GET /api/v1/admin/workers/:workerId/config`
- `POST /api/v1/admin/workers/:workerId/vars`
- `POST /api/v1/admin/workers/:workerId/secret`
- `POST /api/v1/admin/workers/:workerId/deploy`
- `GET /api/v1/admin/workers/:workerId/tail`
- `GET /api/v1/admin/workers/d1/databases`
- `GET /api/v1/admin/workers/kv/namespaces`
- `GET /api/v1/admin/workers/r2/buckets`

## 게시글/이미지/Admin Ops

- `POST /api/v1/admin/create-post-pr`
- `POST /api/v1/images/upload`
- `GET /api/v1/admin/ai-images/health`
- `POST /api/v1/admin/ai-images/generate`
- `POST /api/v1/admin/propose-new-version`
- `POST /api/v1/admin/archive-comments`
- `GET /api/v1/admin/backend-outbox`
- `POST /api/v1/admin/backend-outbox/flush`
