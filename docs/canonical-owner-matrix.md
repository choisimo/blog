# Canonical Owner Matrix

작성일: 2026-03-23

이 문서는 Worker와 Backend가 동시에 `/api/v1/*` surface를 갖는 현재 구조에서
도메인별 canonical owner를 고정하기 위한 기준점이다.

## Owner Matrix

| Domain | Canonical Owner | Why |
| --- | --- | --- |
| Public config and public read orchestration | Worker | Edge cache and geo-aware orchestration belong at the edge. |
| Translation cache query | Worker | Public cache-first read path should stay edge-friendly. |
| Auth and session issuance | Worker | User session issuance is part of the edge-facing public contract. |
| User-facing D1 CRUD | Worker | D1-backed CRUD paths are edge-native and latency-sensitive. |
| Durable notifications and outbox delivery | Backend | Async completion and job fanout live with long-running execution. |
| AI, chat, agent, execute | Backend | Provider integration, queueing, and long-running compute are backend-owned. |
| RAG and embeddings | Backend | Vector store and embedding lifecycle are backend-owned. |
| Durable analytics and reporting | Backend | Postgres-backed aggregation belongs to the backend. |
| Static content authoring and manifest regeneration | Backend | Filesystem and build pipeline ownership stay at origin. |

## Immediate Cleanup Priorities

1. Posts identifier policy
2. User session contract
3. Personas and user-content boundaries
4. Translation owner surface
5. Memories and embeddings boundary

## Working Rule

When a domain is not the canonical owner, its route must be one of:

- proxy
- internal-only facade
- compatibility layer on the path to deprecation

## Contract Classes

모든 route는 아래 세 분류 중 하나로 유지한다.

- external/public route: frontend나 공개 클라이언트가 직접 호출하는 canonical contract
- internal/proxy route: owner가 아닌 레이어가 내부 위임이나 프록시를 위해 유지하는 경로
- deprecated compatibility route: 기존 클라이언트 호환을 위해 잠시 남겨두는 경로

## Current Route Classification

### Translation

| Class | Surface | Notes |
| --- | --- | --- |
| external/public | `GET /api/v1/public/posts/:year/:slug/translations/:lang` | Worker-owned cache query |
| internal/proxy | `POST /api/v1/internal/posts/:year/:slug/translations/:lang/generate` | Authenticated command |
| internal/proxy | `DELETE /api/v1/internal/posts/:year/:slug/translations/:lang` | Admin cache invalidation |
| deprecated compatibility | `GET /api/v1/translate/*` | Legacy read surface |
| deprecated compatibility | `POST /api/v1/translate` | Legacy generate surface |

### Notifications

| Class | Surface | Notes |
| --- | --- | --- |
| external/public | `GET /api/v1/notifications/stream` | Worker-authenticated user-facing SSE entrypoint |
| external/public | `GET /api/v1/notifications/unread` | Durable unread sync |
| external/public | `GET /api/v1/notifications/history` | Durable history sync |
| external/public | `PATCH /api/v1/notifications/:id/read` | Durable read marker |
| internal/proxy | `POST /api/v1/notifications/outbox/internal` | Backend-owned async publication |
| deprecated compatibility | `POST /api/v1/notifications/push` | Legacy direct push surface |

### User Session

| Class | Surface | Notes |
| --- | --- | --- |
| external/public | `POST /api/v1/user/session` | Worker-owned session issuance |
| external/public | `GET /api/v1/user/session/verify` | Session verification |
| external/public | `POST /api/v1/user/session/recover` | Session recovery |

### Memories And Embeddings

| Class | Surface | Notes |
| --- | --- | --- |
| external/public | `GET|POST|PATCH|DELETE /api/v1/memories/*` | Worker-owned source-of-truth CRUD |
| internal/proxy | `POST|DELETE /api/v1/rag/memories/*` | Backend-owned embedding projection |

### Posts

| Class | Surface | Notes |
| --- | --- | --- |
| external/public | `GET /api/v1/posts/:year/:slug` | Backend canonical identifier shape |
| deprecated compatibility | `GET /api/v1/posts/:slug` | Legacy shortcut pending identifier unification |

### Analytics

| Class | Surface | Owner | Notes |
| --- | --- | --- | --- |
| external/public | `POST /api/v1/analytics/view` | Worker (proxy → Backend) | View recording — Worker proxies to Backend Postgres. Single write path. |
| external/public | `GET /api/v1/analytics/stats/:year/:slug` | Worker (proxy → Backend) | Per-post stats read from Postgres via proxy. |
| external/public | `GET /api/v1/analytics/trending` | Worker (proxy → Backend) | Trending posts aggregated from Postgres via proxy. |
| external/public | `GET /api/v1/analytics/editor-picks` | Worker (D1 cache) | Edge-cached editor picks. Source populated by cron from Backend stats. |
| external/public | `GET /api/v1/analytics/realtime` | Worker (KV) | Active visitor count. KV-native, no backend dependency. |
| external/public | `POST /api/v1/analytics/heartbeat` | Worker (KV) | Visitor heartbeat. KV-native. |
| internal/proxy | `POST /api/v1/analytics/refresh-stats` | Worker (proxy → Backend) | Admin-only. Delegates Postgres recalculation to Backend. |
| internal/proxy | `POST /api/v1/analytics/update-editor-picks` | Worker | Admin/cron. Reads stats from Backend, writes editor_picks to D1 cache. |
| internal/proxy | `POST|PUT|DELETE /api/v1/analytics/admin/editor-picks*` | Worker (D1) | Admin management of D1 editor_picks cache. |

**Source-of-truth boundary (2026-03-26):**
- View counts and aggregated stats: Backend (Postgres) — canonical.
- Editor picks display cache: Worker D1 — populated by cron from Postgres, readable at edge.
- Realtime visitor count: Worker KV — TTL-based, no durability required.

**Resolved conflict:** Prior to this change, Worker wrote to both D1 `post_views`/`post_stats`
AND proxied to Backend, causing silent numeric divergence. Worker D1 analytics write paths
have been removed. D1 `post_views` table is now retention-cleanup-only (90d DELETE in cron).
