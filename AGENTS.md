# AGENTS.md — Blog Monorepo

**Generated:** 2026-02-24  
**Commit:** 5c7759da  
**Branch:** main

## OVERVIEW

Personal blog platform (`noblog.nodove.com`) — React SPA on GitHub Pages + Cloudflare Workers API Gateway + Node.js Express origin server (Docker). CI pushes Docker images to GHCR; server self-manages pulls via `ssh blog`.

## STRUCTURE

```
blog/
├── frontend/       # React 18 SPA (Vite + Tailwind + Shadcn + Zustand)
├── backend/        # Node.js Express origin server (Docker, port 5080)
├── workers/        # Cloudflare Workers (api-gateway, r2-gateway, terminal-gateway, seo-gateway)
├── scripts/        # Shell utility scripts (organize-images.sh)
├── .github/
│   └── workflows/  # deploy.yml (GH Pages), deploy-blog-workflow.yml (GHCR push)
├── .gh_env.example # Frontend env var reference
├── CNAME           # noblog.nodove.com
└── nodove.ico      # Favicon
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add a page / route | `frontend/src/pages/` + `frontend/src/App.tsx` |
| Add an API route (Workers) | `workers/api-gateway/src/routes/` |
| Add an API route (Backend) | `backend/src/routes/` + `backend/src/index.js` |
| State management | `frontend/src/stores/` (Zustand) |
| API calls from frontend | `frontend/src/services/` |
| UI components | `frontend/src/components/ui/` (shadcn) |
| Feature components | `frontend/src/components/features/` |
| Auth middleware | `backend/src/middleware/adminAuth.js`, `backendAuth.js`, `userAuth.js` |
| Cloudflare Worker secrets | `wrangler secret put` per worker (see each `wrangler.toml`) |
| CI/CD pipelines | `.github/workflows/` (2 active workflows) |
| Content posts (Markdown) | `frontend/public/posts/` |
| Post/image manifests | `frontend/public/posts-manifest.json` — auto-generated, do NOT hand-edit |
| RAG scripts | `backend/scripts/rag/` |
| Image organization | `scripts/organize-images.sh` |

## ARCHITECTURE

```
Browser → seo-gateway (noblog.nodove.com) → GitHub Pages (static)
Browser → api-gateway (api.nodove.com)    → Workers D1/R2/KV   OR
                                          → backend (BACKEND_ORIGIN via CF Tunnel)
Browser → terminal-gateway               → backend terminal-server
```

- **Workers** handle most API logic natively (D1, R2, KV).  
- **Backend** is the origin for: AI/agent, chat WebSocket, heavy processing.  
- **Backend does NOT get deployed by CI** — server owner runs `git pull && docker-compose up -d`.

## COMMANDS

```bash
# Frontend
cd frontend
npm run dev                    # Vite dev server
npm run build                  # Full prod build (runs pre/post hooks)
npm run type-check             # tsc --noEmit
npm run lint                   # ESLint (0 warnings enforced)
npm run format                 # Prettier
npm run test:run               # Vitest

# Backend
cd backend
npm run dev                    # node --watch src/index.js
npm run worker                 # AI worker process

# Workers (run from workers/)
cd workers
npm run dev                    # wrangler dev (api-gateway default)
npm run deploy                 # deploy to staging
npm run deploy:prod            # deploy to production
npm run migrations:apply:prod  # D1 migrations → production
npm run typecheck              # tsc --noEmit
```

## CONVENTIONS

- **Commit style**: `type(scope): message` — `fix:`, `feat:`, `ci:`, `chore:` (English)
- **Frontend config** lives in `frontend/config/` (vite, eslint, prettier, tailwind, tsconfig)
- **Frontend scripts** live in `frontend/scripts/` (manifest generation, SEO, korean-normalize)
- **Backend** is plain JavaScript (ESM), no TypeScript
- **Workers** are TypeScript; build with `wrangler`
- `frontend/public/posts-manifest.json` and sibling manifests are **CI-generated** — never edit manually
- `.env` loads from parent dir first (`../`), then local override (backend pattern)
- Consul used for backend runtime config — see `backend/consul/services/*.json`
- Feature flags served from backend `/api/v1/config/feature-flags` — frontend polls via `useFeatureFlagsStore`

## ANTI-PATTERNS

- **No SSH in CI** — backend server self-manages; do NOT add SSH deploy steps to workflows
- **No `blog-backend/` paths** — deleted; use `backend/`, `workers/`, `scripts/`
- **No shared/ or doc-converter/ or ai-orchestrator/** — these were deleted; do not re-create
- Do NOT edit auto-generated files: `posts-manifest.json`, `projects-manifest.json`, `sitemap.xml`, `rss.xml`, `robots.txt`
- Do NOT add TypeScript to `backend/` — it is intentionally plain JS (ESM)
- Do NOT commit `.env` files — use `.gh_env.example` as reference
- Workers secrets are managed via `wrangler secret put` — never hardcode in `wrangler.toml`

## DEPLOYMENT

| Component | How it deploys |
|-----------|----------------|
| Frontend | GitHub Actions `deploy.yml` → GitHub Pages + `gh-pages` branch |
| Backend | Owner runs `ssh blog` → `git pull && docker-compose up -d` |
| Workers | `wrangler deploy --env production` (manual or via CI if added) |
| Backend image | GitHub Actions `deploy-blog-workflow.yml` → pushed to `ghcr.io` |

## NOTES

- `patch.js` / `patch2.js` at root — one-off migration scripts, likely stale
- `workers/migrations/` — D1 SQL migration files (apply with `npm run migrations:apply:prod`)
- `backend/terminal-server/` — separate WebSocket server for web terminal feature
- `frontend/verification-screenshots/` — Playwright screenshot artifacts, do not delete (test evidence)
- Korean text normalization enforced via `npm run korean:scan` (pre-commit hook via husky)
