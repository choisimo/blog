# Architecture Audit — noblog.nodove.com

**Generated:** 2026-03-10  
**Branch:** main  
**Auditor:** Sisyphus (automated analysis)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Live Health Status](#2-live-health-status)
3. [Architecture Layers & Design Patterns](#3-architecture-layers--design-patterns)
4. [Endpoint Inventory & Frontend↔Backend Consistency](#4-endpoint-inventory--frontendbackend-consistency)
5. [Service Completeness](#5-service-completeness)
6. [Hardcoded / Placeholder Values](#6-hardcoded--placeholder-values)
7. [Database Schema & Transaction Management](#7-database-schema--transaction-management)
8. [Container State & Docker Compose](#8-container-state--docker-compose)
9. [CI/CD Automation & Deployment Status](#9-cicd-automation--deployment-status)
10. [Known Defects & Error-Prone Areas](#10-known-defects--error-prone-areas)
11. [Security Observations](#11-security-observations)
12. [Recommendations](#12-recommendations)

---

## 1. System Overview

```
Browser
  │
  ├─ GET noblog.nodove.com  ──► seo-gateway (Cloudflare Worker)
  │                               └─► GitHub Pages (React SPA, static)
  │
  └─ XHR api.nodove.com     ──► api-gateway (Cloudflare Worker, Hono)
                                   ├─► D1 / R2 / KV  (Workers-native, no backend needed)
                                   └─► Cloudflare Tunnel ──► blog-b.nodove.com:5080
                                                               └─► Express origin (Docker)
                                                                     ├─ Redis (cache/queue)
                                                                     ├─ ChromaDB (RAG/vector)
                                                                     └─ SurrealDB (open-notebook)

assets-b.nodove.com   ──► r2-gateway (Cloudflare Worker)  ──► R2 bucket
terminal.nodove.com   ──► terminal-gateway (Cloudflare Worker) ──► WebSocket backend
```

### Technology Stack

| Layer | Runtime | Language | Framework |
|-------|---------|----------|-----------|
| Frontend | Browser / GitHub Pages | TypeScript | React 18 + Vite + Tailwind + Shadcn + Zustand |
| api-gateway | Cloudflare Workers | TypeScript | Hono |
| seo-gateway | Cloudflare Workers | TypeScript | Hono |
| r2-gateway | Cloudflare Workers | TypeScript | Hono |
| terminal-gateway | Cloudflare Workers | TypeScript | Hono |
| Backend origin | Node.js 20 (Docker) | ESM JavaScript | Express |
| DB (edge) | Cloudflare D1 | SQL (SQLite dialect) | — |
| Cache | Redis 7 (Docker) | — | ioredis |
| Vector DB | ChromaDB (Docker) | — | chromadb client |
| Graph DB | SurrealDB v2 (Docker) | — | Open Notebook |

---

## 2. Live Health Status

Probed 2026-03-10:

| Endpoint | URL | Status | Response |
|----------|-----|--------|----------|
| Backend nginx | `https://blog-b.nodove.com` | ✅ UP | `{"status":"ok","service":"blog-backend-nginx","ssl":true}` |
| Workers api-gateway | `https://api.nodove.com/_health` | ✅ UP | `{"ok":true,"worker":"blog-api-gateway","timestamp":"..."}` |
| Backend Express | `https://blog-b.nodove.com/api/v1/healthz` | ✅ UP | `{"ok":true,"env":"production","uptime":636521s}` |

**Backend uptime at probe time: ~7.4 days** — container has been running since last deploy without restart.

---

## 3. Architecture Layers & Design Patterns

### 3.1 Frontend (React SPA)

**Pattern: Repository + Service Layer**

```
frontend/src/
├── pages/          ← Route-level components (no business logic)
├── components/     ← UI atoms/molecules/organisms
├── stores/         ← Zustand state slices (runtime config, feature flags, memos)
├── services/       ← API abstraction layer (Repository pattern)
│   ├── core/       ← fetch-http.adapter.ts, http.port.ts (Port/Adapter pattern)
│   ├── content/    ← posts, images, search
│   └── engagement/ ← contact, subscribe, comments, analytics
└── utils/
    └── network/apiBase.ts  ← single source of truth for API URL
```

**Port/Adapter (Hexagonal)**: `http.port.ts` defines `HttpPort` interface; `fetch-http.adapter.ts` implements it with native `fetch`. Testable and swappable.

**Contact form fallback strategy**: `contact.ts` attempts EmailJS first (client-side), silently falls back to `POST /api/v1/contact` if EmailJS credentials are absent. **`/api/v1/contact` does NOT exist in Workers or backend routes** — see defects section.

**Feature flags**: `useFeatureFlagsStore` polls backend `/api/v1/config/feature-flags` on app mount and updates Zustand store. FAB visibility also reads `localStorage` and `VITE_FEATURE_FAB` env var.

**Notification SSE**: `notificationSSE.ts` connects to `GET /api/v1/notifications/stream` on mount, dispatches events through a custom event bus.

**Routes registered in App.tsx:**

| Path | Component | Guard |
|------|-----------|-------|
| `/` | Index | — |
| `/blog` | Blog | — |
| `/blog/:year/:slug` | BlogPost | — |
| `/post/:year/:slug` | BlogPost | — |
| `/projects` | Projects | — |
| `/about` | About | — |
| `/contact` | → redirect `/about` | — |
| `/insight` | Insight | — |
| `/admin/new-post` | NewPost | `AuthGuard` |
| `/admin/config` | AdminConfig | — (no guard!) |
| `/admin/auth/callback` | AdminAuthCallback | — |

> ⚠️ `/admin/config` has no `AuthGuard`. Any visitor can access the admin config UI. Sensitive actions may still require a token but the UI is fully exposed.

---

### 3.2 Workers — api-gateway

**Pattern: Façade + Router + Bridge + Chain of Responsibility**

```
index.ts (Hono root app)
  │
  ├─ Middleware chain (CoR):
  │   cors → requestLogger → requestTracing → errorHandler
  │
  ├─ Routes (22 route files mounted at /api/v1/*):
  │   auth, posts, comments, ai, chat, images, og, analytics,
  │   translate, config, rag, gateway, memos, memories,
  │   admin-ai, secrets, personas, user-content, search,
  │   user, debate, subscribe
  │
  └─ Static handlers: /, /health, /_health
```

**Façade**: Exposes a single unified `api.nodove.com` surface hiding whether data is served from D1/R2/KV (Workers-native) or proxied to the Express backend.

**Bridge (Proxy)**: `gateway.ts` proxies AI calls to backend. `proxyToBackendAi()` forwards raw requests with injected internal keys, model overrides. No request transformation — pure transparent bridge.

**Router**: Hono sub-apps per domain (auth, posts, etc.) mounted onto root app — standard composable router pattern.

**Config resolution priority** (per `lib/config.ts`):
```
D1 Secret (secrets table) → KV → env var → hardcoded default
```
In-memory cache (60s TTL) on top of KV reads to reduce latency.

---

### 3.3 Backend — Express Origin

**Pattern: MVC + Service Layer + Repository (partial)**

```
src/
├── index.js              ← App bootstrap, middleware stack, route mounting
├── routes/               ← 23 route files (thin controllers)
├── middleware/           ← backendAuth, adminAuth, userAuth, rateLimit, etc.
├── lib/                  ← JWT, email, Redis, ChromaDB helpers
├── application/          ← DI container (bootstrap/container.js), notification stream port
├── scripts/rag/          ← RAG ingestion scripts
└── config.js             ← Centralized config, reads from env + Consul
```

**Middleware stack order in index.js:**
1. `helmet()` — security headers
2. `cors()` — CORS
3. `compression()` — gzip
4. `express.json()` — body parser
5. `morgan` — request logging
6. `rateLimit` — global rate limiter (express-rate-limit)
7. `requireBackendKey` — validates `X-Backend-Key` header (applied globally **after** `/api/v1/notifications` mount)
8. Route handlers

**Application Container (DI)**: `application/bootstrap/container.js` uses `getApplicationContainer()` singleton — provides `notificationStream` port. Structured like a lightweight IoC container.

**Auth dual-mode**:
- `adminAuth.js` — static bearer token OR admin-role JWT
- `userAuth.js` — user/anon JWT; sets `req.userId` + `req.userClaims`
- `backendAuth.js` — `X-Backend-Key` HMAC-timing-safe comparison

**In-memory state** (backend `auth.js`):
- `refreshTokenStore` — `Set<string>` — NOT persisted; cleared on process restart
- `totpChallenges` — `Map` with 5-min TTL, in-memory
- `oauthStates` — `Map` with 5-min TTL, in-memory

> ⚠️ Container restart invalidates all active refresh tokens. Users will be logged out.

---

### 3.4 seo-gateway

**Pattern: Decorator / Interceptor**

Intercepts crawlers (based on `User-Agent`) at `noblog.nodove.com` and serves the same GitHub Pages HTML but with injected Open Graph / Twitter Card meta tags built from D1 post data. Regular browser requests pass through unchanged.

---

### 3.5 r2-gateway

**Pattern: Proxy + Access Control**

Serves R2 bucket objects (`assets-b.nodove.com`). Validates access tokens or public-read permissions before proxying R2 responses to clients.

---

### 3.6 terminal-gateway

**Pattern: WebSocket Bridge**

Proxies WebSocket connections from `terminal.nodove.com` to the `terminal-server` Docker service. Applies rate limiting and auth at the Worker layer before the connection upgrades.

---

## 4. Endpoint Inventory & Frontend↔Backend Consistency

### 4.1 Workers API Routes (api-gateway, `/api/v1/`)

| Route File | Methods | Path | Backend Proxy? |
|------------|---------|------|----------------|
| auth | GET/POST | `/auth/totp/setup`, `/auth/totp/setup/verify`, `/auth/totp/challenge`, `/auth/totp/verify`, `/auth/oauth/github`, `/auth/oauth/github/callback`, `/auth/oauth/google`, `/auth/oauth/google/callback`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/anonymous`, `/auth/anonymous/refresh` | ✅ Proxied to backend |
| posts | GET/POST/PUT/DELETE | `/posts`, `/posts/:id` | Mixed (D1 + backend) |
| comments | GET/POST/PUT/DELETE | `/comments`, `/comments/:id` | ✅ Proxied |
| ai | POST | `/ai/chat`, `/ai/complete`, `/ai/auto-chat` | ✅ Proxied |
| chat | GET/POST | `/chat/*` | ✅ Proxied (WebSocket upgrade) |
| images | GET/POST/DELETE | `/images`, `/images/:id` | ✅ Proxied (R2 upload) |
| og | GET | `/og/:slug` | Workers-native (D1) |
| analytics | POST | `/analytics/event` | Workers-native (D1/KV) |
| translate | POST | `/translate` | ✅ Proxied |
| config | GET | `/config/feature-flags`, `/config/public` | Workers-native (KV + hardcoded) |
| rag | GET/POST | `/rag/*` | ✅ Proxied |
| gateway | POST/GET/PUT | `/gateway/call/*`, `/gateway/vision/*`, `/gateway/config` | ✅ Proxied to backend AI |
| memos | GET/POST/PUT/DELETE | `/memos`, `/memos/:id` | ✅ Proxied |
| memories | GET/POST/PUT/DELETE | `/memories/*` | ✅ Proxied |
| admin-ai | POST/GET | `/admin/ai/*` | ✅ Proxied |
| secrets | GET/POST/PUT/DELETE | `/admin/secrets/*` | Workers-native (D1 secrets table) |
| personas | GET/POST/PUT/DELETE | `/personas/*` | ✅ Proxied |
| user-content | GET/POST | `/user-content/*` | ✅ Proxied |
| search | GET | `/search` | ✅ Proxied |
| user | GET/PUT | `/user/*` | ✅ Proxied |
| debate | GET/POST | `/debate/*` | ✅ Proxied |
| subscribe | POST/GET | `/subscribe`, `/subscribe/confirm` | Workers-native (D1) |

### 4.2 Backend Routes (`/api/v1/`)

| Route File | Mounted Path | Auth Guard |
|------------|-------------|------------|
| notifications | `/api/v1/notifications` | None (mounted BEFORE `requireBackendKey`) |
| ai | `/api/v1/ai` | `backendAuth` |
| comments | `/api/v1/comments` | `backendAuth` |
| analytics | `/api/v1/analytics` | `backendAuth` |
| chat | `/api/v1/chat` | `backendAuth` |
| translate | `/api/v1/translate` | `backendAuth` |
| memos | `/api/v1/memos` | `backendAuth` |
| user-content | `/api/v1/user-content` | `backendAuth` |
| og | `/api/v1/og` | `backendAuth` |
| admin | `/api/v1/admin` | `backendAuth` + `adminAuth` |
| posts | `/api/v1/posts` | `backendAuth` |
| images | `/api/v1/images` | `backendAuth` |
| auth | `/api/v1/auth` | None (public auth endpoints) |
| rag | `/api/v1/rag` | `backendAuth` |
| memories | `/api/v1/memories` | `backendAuth` |
| user | `/api/v1/user` | `backendAuth` |
| search | `/api/v1/search` | `backendAuth` |
| admin/config | `/api/v1/admin/config` | `backendAuth` + `adminAuth` |
| admin/workers | `/api/v1/admin/workers` | `backendAuth` + `adminAuth` |
| admin/ai | `/api/v1/admin/ai` | `backendAuth` + `adminAuth` |
| agent | `/api/v1/agent` | `backendAuth` |
| debate | `/api/v1/debate` | `backendAuth` |
| documents | `/api/v1/documents` | (undocumented) |

### 4.3 Frontend → Workers Consistency

| Frontend Service | Calls | Worker Route Exists? | Backend Route Exists? |
|-----------------|-------|---------------------|----------------------|
| `contact.ts` | `POST /api/v1/contact` | ❌ **MISSING** | ❌ **MISSING** |
| `notificationSSE.ts` | `GET /api/v1/notifications/stream` | ❌ Workers routes directly | ✅ Backend `/notifications/stream` |
| Posts service | `GET /api/v1/posts` | ✅ | ✅ |
| Auth service | `POST /api/v1/auth/totp/*` | ✅ | ✅ |
| Comments service | `GET/POST /api/v1/comments` | ✅ | ✅ |
| Memos service | `GET/POST /api/v1/memos` | ✅ | ✅ |
| Subscribe | `POST /api/v1/subscribe` | ✅ | — (Workers-native) |
| Config | `GET /api/v1/config/feature-flags` | ✅ | ✅ |

> ⚠️ **`/api/v1/notifications/stream`** — frontend calls it as if the Worker proxies it, but there is no `notifications` route in Workers. SSE traffic must be hitting backend directly or this is broken. Workers SSE proxying is also non-trivial (streaming response). Needs investigation.

> ❌ **`/api/v1/contact`** — Called by `contact.ts` as fallback after EmailJS. Does not exist in Workers routes or backend routes. Will return 404.

---

## 5. Service Completeness

### 5.1 Feature Flag Service
- Workers: `GET /api/v1/config/public` returns hardcoded `features` object (`posts`, `comments`, `ai`, `chat`, `analytics` all `true`)
- Backend: `/api/v1/config/feature-flags` serves dynamic flags from Consul/KV
- **Gap**: Workers config endpoint is fully static — no KV or Consul integration. Frontend polling Workers for flags never gets dynamic overrides from the backend.

### 5.2 Subscription / Newsletter
- Subscribe flow: `POST /api/v1/subscribe` → D1 insert with `status='pending'` → send confirmation email via Resend API
- Confirmation: `GET /api/v1/subscribe/confirm?token=...` → update status to `'confirmed'`
- **Email sending**: Uses `RESEND_API_KEY` + `NOTIFY_FROM_EMAIL` Worker secrets. If either secret is unset, the subscription is silently stored as `pending` forever — subscriber never confirmed.
- New post notifications: `sendNewPostNotification()` in `lib/email.ts` additionally requires `NOTIFY_TO_EMAILS` and `PUBLIC_SITE_URL`. Only fires in `env.ENV === 'production'`.

### 5.3 RAG (Retrieval-Augmented Generation)
- Backend scripts in `backend/scripts/rag/` for ingestion
- Workers proxy `/rag/*` to backend
- ChromaDB container provides vector storage
- **Completeness**: RAG pipeline exists but ingestion is manual (no CI automation). Freshness depends on manual script runs.

### 5.4 AI / Chat
- Backend serves `/api/v1/ai/*` and `/api/v1/chat/*`
- Workers proxy via `gateway.ts` (AI gateway) and `ai.ts` / `chat.ts` route files
- Model selection: KV or D1 secrets override env vars — fully runtime-configurable via `PUT /gateway/config`
- Perplexity (web search), Gemini (vision) used as providers

### 5.5 Debate Arena
- D1 migration 0019 adds `debate_*` tables
- Workers route `debate.ts` proxies to backend `debate.js`
- Appears complete in schema but backend implementation not fully audited

### 5.6 Notifications (SSE)
- Backend: `GET /stream` (userAuth), `POST /push` (backendAuth), `GET /health` (backendAuth)
- Pattern: `notificationStream` port via DI container, 25s heartbeat ping to keep proxies alive
- Frontend: `initNotificationSSE()` called on App mount
- **Gap**: No Workers route for `/notifications/*`. Frontend must be calling backend directly or through a non-documented path. If Workers intercepts all `api.nodove.com` traffic, SSE will fail unless Workers has a passthrough or the frontend calls `blog-b.nodove.com` directly.

### 5.7 Admin Panel
- `AdminConfig` page at `/admin/config` — **no `AuthGuard`**
- TOTP setup, OAuth configuration visible to unauthenticated users (read-only risk varies by implementation)
- `NewPost` at `/admin/new-post` — correctly guarded by `AuthGuard`

---

## 6. Hardcoded / Placeholder Values

| Location | Value | Severity | Notes |
|----------|-------|----------|-------|
| `workers/api-gateway/src/routes/auth.ts:243` | `admin@totp.local` | 🟡 Medium | Placeholder email in TOTP JWT payload; should use `ADMIN_EMAIL` env var |
| `backend/src/routes/auth.js` | `admin@local` | 🟡 Medium | Fallback email in `issueTokens()` and `/auth/me`; `process.env.ADMIN_EMAIL` is checked first |
| `backend/docker-compose.yml:201` | `SURREALDB_ROOT_PASSWORD:-surrealdb` | 🔴 High | If env var unset, DB root password is literally `surrealdb` |
| `backend/docker-compose.yml` | `SANDBOX_IMAGE:-alpine:latest` | 🟢 Low | Acceptable default for sandboxed code execution |
| `workers/api-gateway/wrangler.toml` | `account_id = "f6f11e2a4e5178d2f37476785018f761"` | 🟢 Low | CF account ID in repo — non-secret but unnecessary exposure |
| `workers/api-gateway/src/index.ts` | `features` object all `true` | 🟡 Medium | Static feature flags — no dynamic override possible from Workers layer |
| `workers/api-gateway/src/lib/config.ts` | `DEFAULTS.AI_SERVE_URL = 'https://blog-b.nodove.com'` | 🟢 Low | Hardcoded fallback URL — fine as last-resort default |
| `backend/src/routes/auth.js` | `refreshTokenStore = new Set()` | 🔴 High | In-memory only; restart invalidates all active sessions. No Redis-backed store. |
| `backend/src/routes/auth.js` | `totpChallenges = new Map()` | 🟡 Medium | In-memory; restart clears pending challenges (5-min window, low impact) |
| `backend/src/routes/auth.js` | `oauthStates = new Map()` | 🟡 Medium | In-memory OAuth PKCE states; restart during OAuth flow causes `invalid_state` error |
| `frontend/src/services/engagement/contact.ts` | `EMAILJS_ENDPOINT` hardcoded | 🟢 Low | Public EmailJS API URL; fine as constant |

---

## 7. Database Schema & Transaction Management

### 7.1 D1 Schema (22 migrations, 0001–0022)

| Migration | Tables Added |
|-----------|-------------|
| 0001 | `users`, `posts`, `tags`, `post_tags`, `comments`, `attachments`, `settings` |
| 0002–0010 | (analytics, images, subscribers, sessions, various feature tables) |
| 0011–0015 | (memos, memories, user_content, personas, ai_playground) |
| 0016–0018 | (rag_documents, agent_sessions, secrets_store) |
| 0019 | `debate_arenas`, `debate_arguments`, `debate_votes` |
| 0020 | `ai_traces`, `agent_orchestration` |
| 0021 | `user_preferences`, `notifications` |
| 0022 | `advanced_fingerprints`, subscriber confirmations |

### 7.2 Transaction Management Assessment

**Workers (D1)**:
- D1 does not expose multi-statement transactions via the current Workers binding API (as of wrangler v3).
- All Workers D1 writes appear to be single-statement operations — consistent with D1 limitations.
- No evidence of explicit `BEGIN/COMMIT/ROLLBACK` usage in Workers route files (correct behavior for D1).
- **Risk**: Operations that logically require atomicity (e.g., insert post + insert post_tags) are NOT atomic. Partial writes are possible on error.

**Backend (SQLite via D1 migrations, Redis)**:
- Backend does not directly access D1 — it uses its own in-process state (in-memory Maps/Sets) and Redis.
- No ORM detected — raw queries or `d1-utils` style helpers.
- Redis usage: cache for rate limiting, session data, task queue (BullMQ or similar). Atomic operations use Redis `MULTI/EXEC` where available.

**Transaction Risk Summary**:
- 🔴 **No atomic post creation** — post insert + tag associations + attachment metadata are separate D1 statements
- 🟡 **Subscriber confirmation** — D1 `UPDATE status` on confirm is single-statement (safe)
- 🟡 **Comment moderation** — single-statement updates (safe)
- 🟢 **Read-heavy paths** — no transaction concerns

---

## 8. Container State & Docker Compose

### 8.1 Services

| Service | Image | Port | Auto-Update | Status |
|---------|-------|------|-------------|--------|
| `api` | `ghcr.io/choisimo/blog-api:latest` | 5080 | ✅ Watchtower | Running (uptime 7.4d) |
| `nginx` | `nginx:alpine` | 80/443 | ❌ | Running (healthy) |
| `terminal-server` | `ghcr.io/choisimo/blog-terminal:latest` | 8081 | ✅ Watchtower | Unknown |
| `workers-local` | `blog-workers-local:latest` | — | ❌ | Development only |
| `chromadb` | `chromadb/chroma:latest` | 8000 | ❌ | Unknown |
| `redis` | `redis:7-alpine` | 6379 | ❌ | Unknown |
| `surrealdb` | `surrealdb/surrealdb:v2` | 8090 | ❌ | Unknown |
| `open-notebook` | `lfnovo/open_notebook:v1-latest` | 3000 | ❌ | Unknown |
| `watchtower` | `containrrr/watchtower:latest` | — | — | Running, polls every 5 min |

### 8.2 Watchtower Auto-Deploy
- Watchtower polls GHCR every 5 minutes for new `blog-api` and `blog-terminal` image tags.
- On new image detected: pulls, stops old container, starts new one.
- **No zero-downtime**: Brief outage (~5–10 seconds) during container replacement.
- No health-check gate before Watchtower considers a new container healthy.

### 8.3 Volume Mounts
- `./data/redis` → Redis persistence
- `./data/chromadb` → Vector DB persistence
- `./data/surrealdb` → Graph DB persistence
- `./backend/.env` (or `../.env`) — environment file bind-mount

### 8.4 Risks
- 🔴 `SURREALDB_ROOT_PASSWORD` defaults to `surrealdb` if env var unset
- 🟡 No resource limits (CPU/memory) defined for any container
- 🟡 `blog-b.nodove.com` is directly exposed through Cloudflare Tunnel — `X-Backend-Key` is the sole protection layer; if the key leaks, backend is fully accessible
- 🟡 `workers-local` container in production `docker-compose.yml` — should be in a separate dev override file

---

## 9. CI/CD Automation & Deployment Status

### 9.1 Workflows

#### `deploy.yml` — Frontend → GitHub Pages
- **Trigger**: `push` to `main` on `frontend/**`
- **Steps**: Install → `npm run build` → upload artifact → deploy to GitHub Pages → sync to `gh-pages` branch → auto-commit generated manifests + SEO files back to `main`
- **Status**: ✅ Active and working
- **Concern**: Auto-commit step uses `GITHUB_TOKEN` to push back to `main` — could trigger recursive workflow runs (guarded by `[skip ci]` message or GitHub's built-in loop protection)

#### `deploy-blog-workflow.yml` — Backend → GHCR
- **Trigger**: `push` to `main` on `backend/**`
- **Steps**: Build Docker image → push `ghcr.io/choisimo/blog-api:latest` + `blog-terminal:latest`
- **Status**: ✅ Active, pushes images
- **Deployment to server**: NOT automatic. Watchtower on the server polls GHCR every 5 min and auto-pulls. Effective lag: up to 5 minutes after image push.

#### `deploy-workers.yml` — Cloudflare Workers → Production
- **Trigger**: `push` to `main` on `workers/**`
- **Steps**: Inject runtime secrets → `wrangler deploy --env production`
- **Status**: ✅ Active
- **Coverage**: Only `api-gateway` is deployed. `r2-gateway`, `terminal-gateway`, `seo-gateway` are NOT included in this workflow — manual deploy required for those three Workers.

### 9.2 Missing CI Coverage

| Component | CI Coverage | Manual Deploy Required |
|-----------|-------------|----------------------|
| Frontend | ✅ Automated | No |
| Backend API image | ✅ Automated (build + push) | Watchtower handles pull (5 min lag) |
| api-gateway Worker | ✅ Automated | No |
| r2-gateway Worker | ❌ None | Yes |
| terminal-gateway Worker | ❌ None | Yes |
| seo-gateway Worker | ❌ None | Yes |
| D1 Migrations | ❌ None | Yes (`npm run migrations:apply:prod`) |

---

## 10. Known Defects & Error-Prone Areas

### 🔴 Critical

#### DEF-001: Email sending broken (subscriber confirmations)
- **Location**: `workers/api-gateway/src/routes/subscribe.ts`
- **Root cause**: `sendConfirmationEmail()` reads `env.RESEND_API_KEY` and `env.NOTIFY_FROM_EMAIL`. If either Worker secret is unset, function returns `false` silently. Subscriber is still inserted into D1 with `status='pending'` but never receives a confirmation email.
- **Impact**: All new subscribers remain in `pending` state indefinitely; they never confirm, so they never receive post notifications.
- **Fix**: Verify `RESEND_API_KEY` and `NOTIFY_FROM_EMAIL` are set via `wrangler secret put RESEND_API_KEY` and `wrangler secret put NOTIFY_FROM_EMAIL`. Also add logging to distinguish "silent skip" from actual Resend API errors.

#### DEF-002: `/api/v1/contact` endpoint missing
- **Location**: `frontend/src/services/engagement/contact.ts`
- **Root cause**: Frontend `sendViaApi()` fallback calls `POST /api/v1/contact`. This route does not exist in Workers routes or backend routes.
- **Impact**: Contact form submissions fail with 404 when EmailJS credentials are absent or EmailJS fails.
- **Fix**: Add `contact.ts` route to Workers (can proxy to backend email handler) OR add `POST /api/v1/contact` to backend with Nodemailer/Resend. EmailJS credentials should also be added to frontend env vars.

#### DEF-003: Refresh tokens not persisted (session loss on restart)
- **Location**: `backend/src/routes/auth.js` — `refreshTokenStore = new Set()`
- **Root cause**: Refresh tokens stored in-memory only. Any container restart (Watchtower auto-update, crash, manual deploy) invalidates all active admin sessions.
- **Impact**: Admin is logged out every time the backend container restarts (up to every 5 min if Watchtower deploys a new image).
- **Fix**: Store refresh tokens in Redis with TTL. `refreshTokenStore.add(token)` → `redis.set(token, '1', 'EX', 604800)`.

### 🟡 Medium

#### DEF-004: `/api/v1/notifications/stream` SSE path unclear
- **Location**: `frontend/src/services/realtime/notificationSSE.ts`
- **Root cause**: Frontend calls `api.nodove.com/api/v1/notifications/stream`. Workers `api-gateway` has no `notifications` route file. SSE streaming through Cloudflare Workers is limited (response body streaming works but long-lived connections may be terminated by the 30s subrequest timeout).
- **Impact**: Real-time notifications may silently fail or disconnect frequently.
- **Fix**: Add a `notifications.ts` route to Workers that proxies the SSE stream from backend, or document that this path intentionally bypasses Workers.

#### DEF-005: `/admin/config` page has no authentication guard
- **Location**: `frontend/src/App.tsx` — Route for `/admin/config`
- **Root cause**: `AdminConfig` component renders without `<AuthGuard>` wrapper.
- **Impact**: Any user can navigate to the admin config page. Even if sensitive mutations require a token, the UI is exposed and may leak configuration information (displayed values, available options).
- **Fix**: Wrap `<AdminConfig />` in `<AuthGuard>` like `<NewPost />`.

#### DEF-006: In-memory OAuth state / TOTP challenges lost on restart
- **Location**: `backend/src/routes/auth.js`
- **Root cause**: `oauthStates` and `totpChallenges` are in-memory Maps. Restart during an active OAuth flow → `invalid_state` error. Restart during TOTP challenge → expired challenge.
- **Impact**: Rare but possible. 5-minute TTL windows reduce impact. Watchtower restarts exacerbate this.
- **Fix**: Store in Redis with matching TTL.

#### DEF-007: `workers-local` container in production compose file
- **Location**: `backend/docker-compose.yml`
- **Root cause**: `workers-local` service (wrangler dev emulator) is present in the same `docker-compose.yml` used in production.
- **Impact**: Unnecessary resource consumption; potential confusion about which Worker code is serving traffic.
- **Fix**: Move to `docker-compose.dev.yml` or use profiles (`docker compose --profile dev up`).

#### DEF-008: Feature flags not dynamic from Workers layer
- **Location**: `workers/api-gateway/src/routes/config.ts`
- **Root cause**: `features` object in `buildPublicConfig()` is hardcoded `{ posts: true, comments: true, ai: true, chat: true, analytics: true }`. Not read from KV or backend.
- **Impact**: Feature flags cannot be toggled at edge without redeploying Workers.
- **Fix**: Read feature flag values from KV with fallback to hardcoded defaults.

#### DEF-009: `r2-gateway`, `terminal-gateway`, `seo-gateway` not in CI
- As documented in §9.2. Any changes to these Workers require manual `wrangler deploy`.

### 🟢 Low

#### DEF-010: `admin@totp.local` placeholder email in Workers JWT
- `auth.ts:243` in Workers uses `admin@totp.local` in TOTP challenge JWT payload instead of reading `ADMIN_EMAIL` env var.

#### DEF-011: No container resource limits
- Docker services have no `mem_limit` or `cpus` constraints. A runaway AI/RAG job could starve other services.

#### DEF-012: No D1 migration CI automation
- Migrations must be applied manually via `npm run migrations:apply:prod`. Risk of schema drift between code and production DB after unattended deploys.

---

## 11. Security Observations

| Item | Severity | Detail |
|------|----------|--------|
| `X-Backend-Key` is sole protection for backend | 🟡 Medium | Workers are trusted; if the Worker is compromised or key leaks, backend is directly accessible |
| Refresh tokens in memory | 🔴 High | Session invalidation on every container restart (Watchtower runs every 5 min) |
| SurrealDB default password | 🔴 High | `surrealdb` literal if env var unset |
| `admin@totp.local` in JWT | 🟡 Medium | Placeholder email may appear in audit logs |
| `/admin/config` unguarded | 🟡 Medium | UI exposed without auth |
| OAuth state in memory | 🟡 Medium | CSRF state lost on restart |
| `timingSafeEqual` length branch | 🟢 Low | `backendAuth.js` correctly runs dummy `timingSafeEqual` on length mismatch to prevent timing leak — good |
| JWT access token 15m, refresh 7d | 🟢 Low | Reasonable TTLs |
| TOTP secret persisted to `.env` on setup | 🟢 Low | `upsertEnvVar()` writes `TOTP_SECRET` to disk after first verify — good for persistence but file must be in `.gitignore` |
| `crypto.timingSafeEqual` used for backend key | 🟢 Low | Correct usage |

---

## 12. Recommendations

### Immediate (this week)

1. **Fix email sending** — Run `wrangler secret put RESEND_API_KEY` and `wrangler secret put NOTIFY_FROM_EMAIL` in production. Add `NOTIFY_TO_EMAILS` for post notifications. Add error logging to `sendConfirmationEmail()`.

2. **Add `/api/v1/contact` route** — Either a Workers-native handler using Resend, or proxy to a new backend route. Also add EmailJS env vars to production GitHub Actions secrets.

3. **Persist refresh tokens to Redis** — Replace in-memory `Set` with Redis calls using `SETEX`. This fixes session loss on every Watchtower deploy.

4. **Guard `/admin/config`** — Add `<AuthGuard>` wrapper in `App.tsx`.

5. **Fix SurrealDB default password** — Set `SURREALDB_ROOT_PASSWORD` explicitly in the deployment `.env` file.

### Short-term (this sprint)

6. **Add Workers notifications proxy or document SSE path** — Either add `notifications.ts` to Workers that SSE-streams from backend, or configure Cloudflare Tunnel rule to route `/api/v1/notifications/*` directly to backend.

7. **Add CI for remaining Workers** — Add `r2-gateway`, `terminal-gateway`, `seo-gateway` deploy steps to `deploy-workers.yml`.

8. **Add D1 migration CI step** — Run `migrations:apply:prod` automatically after Workers deploy when migration files change.

9. **Move `workers-local` to dev compose profile** — Use Docker Compose profiles or a separate `docker-compose.dev.yml`.

### Medium-term

10. **Dynamic feature flags at edge** — Read from KV in `config.ts` Workers route with hardcoded fallback.

11. **Atomic D1 writes** — Where post creation involves multiple tables, consider a D1 batch statement (`db.batch([...])`) to reduce partial-write window.

12. **Move OAuth/TOTP state to Redis** — Prevents auth flow interruption on container restarts.

13. **Add container resource limits** — Set `mem_limit`/`cpus` for AI worker, ChromaDB, and Redis containers.

14. **Replace `admin@totp.local`** — Read from `ADMIN_EMAIL` env var in Workers `auth.ts`.

---

*End of audit. Generated by automated static analysis + live endpoint probing. No production data was accessed.*
