# 관리자 API 사용 범위

이 Flutter 앱에서 선언되거나 호출되는 현재 관리자 API를 Worker/Backend registration과 대조한 목록입니다. 2026-08-12 기준 고유한 `method + path pattern`은 103개이며, `GET /auth/me`를 제외한 102개가 UI·자동 refresh·stream 경로에서 도달 가능합니다. `GET /auth/me`는 `AuthStore.getMe`에 구현되어 있지만 현재 UI 호출자는 없습니다.

`POST`, `PUT`, `DELETE` 요청에는 앱이 `Idempotency-Key`를 자동 부착합니다. 서버가 해당 계약을 구현한 경로에서만 중복 억제가 보장됩니다. finite 요청에는 timeout이 적용되며, logs stream은 연결 수립에만 timeout이 적용됩니다.

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

Health 화면은 AI 관리 절의 `GET /api/v1/admin/ai/providers`도 재사용합니다.

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

- `GET /api/v1/admin/ai/providers`
- `POST /api/v1/admin/ai/providers`
- `PUT /api/v1/admin/ai/providers/:id`
- `PUT /api/v1/admin/ai/providers/:id/health`
- `POST /api/v1/admin/ai/providers/:id/kill-switch`
- `POST /api/v1/admin/ai/providers/:id/enable`
- `DELETE /api/v1/admin/ai/providers/:id`
- `GET /api/v1/admin/ai/models`
- `POST /api/v1/admin/ai/models`
- `PUT /api/v1/admin/ai/models/:id`
- `DELETE /api/v1/admin/ai/models/:id`
- `GET /api/v1/admin/ai/routes`
- `POST /api/v1/admin/ai/routes`
- `PUT /api/v1/admin/ai/routes/:id`
- `DELETE /api/v1/admin/ai/routes/:id`
- `POST /api/v1/admin/ai/playground/run`
- `GET /api/v1/admin/ai/playground/history`
- `GET /api/v1/admin/ai/playground/history/:id`
- `DELETE /api/v1/admin/ai/playground/history/:id`
- `DELETE /api/v1/admin/ai/playground/history`
- `GET /api/v1/admin/ai/usage`
- `GET /api/v1/admin/ai/config/export`
- `GET /api/v1/admin/ai/traces`
- `GET /api/v1/admin/ai/traces/:id`
- `GET /api/v1/admin/ai/traces/stats/summary`
- `GET /api/v1/admin/ai/prompt-templates`
- `POST /api/v1/admin/ai/prompt-templates`
- `PUT /api/v1/admin/ai/prompt-templates/:id`
- `POST /api/v1/admin/ai/prompt-templates/:id/use`
- `DELETE /api/v1/admin/ai/prompt-templates/:id`
- `GET /api/v1/agent/prompts`
- `PUT /api/v1/agent/prompts/:mode`
- `DELETE /api/v1/agent/prompts/:mode`

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
- `GET /api/v1/admin/secrets`
- `POST /api/v1/admin/secrets`
- `GET /api/v1/admin/secrets/:id`
- `PUT /api/v1/admin/secrets/:id`
- `DELETE /api/v1/admin/secrets/:id`
- `POST /api/v1/admin/secrets/:id/reveal`
- `POST /api/v1/admin/secrets/generate`
- `GET /api/v1/admin/secrets/categories`
- `POST /api/v1/admin/secrets/categories`
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
