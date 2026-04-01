# AGENTS.md — backend/

## OVERVIEW

Node.js Express origin server (Docker, port 5080). Plain JavaScript ESM — no TypeScript. Handles AI/agent processing, chat WebSocket, RAG, and heavy compute. Accessed via Cloudflare Tunnel as `BACKEND_ORIGIN` from api-gateway Worker.

## STRUCTURE

```
backend/
├── src/
│   ├── index.js         # Express entry point — registers all routes
│   ├── config.js        # Config loader (dotenv + Consul)
│   ├── config/          # env.js, constants.js, schema.js
│   ├── routes/          # Express routers (one file per domain)
│   ├── middleware/      # Auth, rate-limit, error handling, validation
│   ├── services/        # Business logic (ai/, agent/, chat, posts, etc.)
│   ├── lib/             # Shared utilities (ai-service, redis, d1, jwt, r2, etc.)
│   ├── repositories/    # Data access layer (D1, R2, memory)
│   └── workers/         # Background workers (ai-worker.js)
├── scripts/rag/         # Python RAG indexing scripts
├── consul/
│   ├── config/          # Consul agent config
│   └── services/        # Service definitions (backend.json, redis.json, etc.)
├── nginx/               # nginx config for local dev proxy
├── terminal-server/     # Separate WebSocket server for web terminal
└── Dockerfile           # Node 20 Alpine, port 5080
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add Express route | `src/routes/<domain>.js` + register in `src/index.js` |
| Add business logic | `src/services/<domain>.service.js` |
| Add data access | `src/repositories/<domain>.repository.js` |
| Auth middleware | `src/middleware/adminAuth.js` (admin JWT), `userAuth.js` (user JWT), `backendAuth.js` (inter-service key) |
| Config / env vars | `src/config/env.js` — also checks `../.env` then `.env` |
| Runtime config (Consul) | `src/config.js` + `consul/services/backend.json` |
| AI service | `src/services/ai/ai.service.js`, `src/lib/ai-service.js` |
| AI agent | `src/lib/agent/coordinator.js`, `src/services/agent/coordinator.service.js` |
| RAG indexing | `scripts/rag/` (Python) |
| WebSocket chat | `src/routes/chat.js` → `src/services/chat.service.js` |
| Rate limiting | `src/middleware/rateLimit.js`, `src/lib/ai-rate-limiter.js` |

## ROUTES

All registered in `src/index.js`:

| Mount | File | Purpose |
|-------|------|---------|
| `/api/v1/ai` | `routes/ai.js` | AI completions |
| `/api/v1/agent` | `routes/agent.js` | AI agent orchestration |
| `/api/v1/chat` | `routes/chat.js` | WebSocket + REST chat |
| `/api/v1/comments` | `routes/comments.js` | Post comments |
| `/api/v1/posts` | `routes/posts.js` | Post CRUD |
| `/api/v1/memories` | `routes/memories.js` | AI memories |
| `/api/v1/memos` | `routes/memos.js` | User memos |
| `/api/v1/rag` | `routes/rag.js` | RAG search |
| `/api/v1/auth` | `routes/auth.js` | JWT auth |
| `/api/v1/config` | `routes/config.js` | Feature flags, runtime config |
| `/api/v1/admin` | `routes/admin.js` | Admin operations |
| `/api/v1/translate` | `routes/translate.js` | Translation |

## CONVENTIONS

- **Plain ESM JavaScript** — no TypeScript, no `require()`, use `import/export`
- **No ORM** — raw SQL via `better-sqlite3` or D1 repository pattern
- **Config loading**: `dotenv` loads `../.env` (parent) then `./env` (override). Consul overlays at runtime.
- **Auth layers**: backend-to-backend uses `X-Backend-Key` header (`backendAuth.js`); user JWT via `Authorization: Bearer`; admin JWT via `adminAuth.js`
- **Service pattern**: `routes/*.js` → `services/*.service.js` → `repositories/*.repository.js`
- **AI worker**: Long-running tasks dispatched to `src/workers/ai-worker.js` (separate process)

## ANTI-PATTERNS

- Do NOT add TypeScript — intentionally plain JS (ESM)
- Do NOT bypass `backendAuth.js` for internal routes — require `X-Backend-Key`
- Do NOT add SSH-based deployment to CI — server self-manages via `git pull && docker-compose up -d`
- Do NOT hardcode secrets — use env vars or Consul KV
- Do NOT call Consul directly from routes — use `src/config.js` helpers

## COMMANDS

```bash
npm run dev     # node --watch src/index.js (auto-restart)
npm run start   # node src/index.js (production)
npm run worker  # node src/workers/ai-worker.js
npm run worker:dev  # node --watch src/workers/ai-worker.js
```

## DEPLOYMENT

- Server owner runs: `ssh blog` → `git pull && docker-compose up -d`
- CI builds + pushes Docker image to `ghcr.io` via `deploy-blog-workflow.yml` — server pulls image on next restart
- Port `5080` exposed; Cloudflare Tunnel routes `BACKEND_ORIGIN` traffic

## NOTES

- `terminal-server/` is a **separate** WebSocket server — different process, different port
- Consul is optional; if unreachable, falls back to env vars silently
- `better-sqlite3` requires native build toolchain — Dockerfile installs `python3 make g++`
- Redis used for session/rate-limit caching — see `src/lib/redis-client.js`
