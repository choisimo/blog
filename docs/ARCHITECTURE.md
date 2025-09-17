# Unified Architecture Overview

This repository now uses a single, unified backend for all dynamic features while keeping the static blog on GitHub Pages unchanged.

- Static site (React + Vite): `frontend/src/`, `frontend/public/` → built to `frontend/dist/` and deployed to GitHub Pages.
- Unified backend (Express): `backend/` → provides AI, comments, OG image, and admin endpoints.
- Legacy serverless endpoints in `api/` and the old admin server in `blog-admin/` are deprecated. They remain in the tree for now but should not be used for new development. The `doc-converter/` is a client-only static tool and is built and published under `/doc-converter/` on GitHub Pages by the main deploy workflow.

## Directories

- `backend/` – Node/Express API with modular routes and strict config via `zod`.
  - `src/index.js` – App entry: helmet, CORS, rate limit, logs; mounts routes under `/api/v1/*`.
  - `src/config.js` – Typed environment config; public runtime config endpoint.
  - `src/routes/ai.js` – AI endpoints: `POST /api/v1/ai/{summarize|generate|sketch|prism|chain}`.
  - `src/routes/comments.js` – Comments: `GET /api/v1/comments?postId=...`, `POST /api/v1/comments`.
  - `src/routes/og.js` – OG SVG generator: `GET /api/v1/og?title=...&subtitle=...`.
  - `src/routes/admin.js` – Admin endpoints: PR creation and comment archival.
  - `src/lib/*` – Gemini and Firebase admin wrappers.
  - `.env.example` – Backend envs and CORS/limits.
  - `docker-compose.yml`, `nginx.conf`, `Dockerfile` – Optional containerized deployment.

- `frontend/` – Frontend app and static posts (`frontend/public/posts/YYYY/*.md`).
  - `frontend/index.html`
  - `frontend/config/` (vite, eslint, tailwind, postcss)
  - `frontend/scripts/generate-manifests.js` – Validates posts and produces `posts-manifest.json`.
  - `frontend/scripts/generate-seo.js` – Creates `sitemap.xml`, `rss.xml`, updates `robots.txt` at build.

## Endpoints

- Health: `GET /api/v1/healthz`
- Public config: `GET /api/v1/public/config`
- AI:
  - `POST /api/v1/ai/summarize` { text|input, instructions? }
  - `POST /api/v1/ai/generate` { prompt, temperature? }
  - `POST /api/v1/ai/{sketch|prism|chain}` { paragraph, postTitle? }
- Comments:
  - `GET /api/v1/comments?postId=...`
  - `POST /api/v1/comments` { postId, author, content, website? }
- OG: `GET /api/v1/og?title=...&subtitle=...&theme=dark|light&w=1200&h=630`
- Admin (Bearer token guarded if `ADMIN_BEARER_TOKEN` is set):
  - `POST /api/v1/admin/propose-new-version` { original?, markdown, sourcePage? }
  - `POST /api/v1/admin/archive-comments?dryRun=1|0`

Note: We follow Octokit v20+ best practices (`octokit.rest.*`) and preserve commit author/committer via `GIT_USER_NAME` and `GIT_USER_EMAIL` if provided.

## Frontend integration

The frontend uses `frontend/src/utils/apiBase.ts#getApiBaseUrl()` to discover the backend at runtime in this order:

1) `window.APP_CONFIG.apiBaseUrl` (injected in `index.html`)
2) `import.meta.env.VITE_API_BASE_URL` (build-time)
3) `localStorage['aiMemo.backendUrl']` (developer convenience)

When `apiBaseUrl` is present, components call the unified backend (`/api/v1/...`). If absent, they fall back to legacy static paths used on GitHub Pages for compatibility.

`frontend/index.html` now injects at runtime:

```html
<script type="module">
  window.APP_CONFIG = Object.assign({}, window.APP_CONFIG || {}, {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || null,
  });
</script>
```

GitHub Actions (`.github/workflows/deploy.yml`) passes `VITE_API_BASE_URL` via a repository secret so the built site knows the backend URL. The pipeline installs and builds in `frontend/` and uploads `frontend/dist` as the Pages artifact.

## Environment

Backend (`backend/.env.example`):

- `APP_ENV` – development|staging|production
- `HOST`, `PORT` – default 0.0.0.0:5080
- `ALLOWED_ORIGINS` – CSV; include `https://blog.nodove.com` and localhost for dev
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`
- `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GIT_USER_NAME`, `GIT_USER_EMAIL`
- `ADMIN_BEARER_TOKEN` – if set, protects admin endpoints with `Authorization: Bearer <token>`

Frontend (build-time):

- `VITE_SITE_BASE_URL` – canonical site URL
- `VITE_API_BASE_URL` – unified backend base URL (e.g., `https://api.nodove.com`)

## Deployment

- Local dev:
  - Backend: `cp backend/.env.example backend/.env && npm --prefix backend install && npm --prefix backend run dev`
  - Frontend: `npm --prefix frontend install && npm --prefix frontend run dev`
- Docker Compose: `cd backend && docker compose up -d` → Nginx at :8091 proxies `/api/*` to API (:5080).
- GitHub Pages builds the static site from `dist/` without serving the API.

## Deprecation Plan

- `api/` (Vercel-style serverless) – functionality migrated to `backend/`. Keep for reference; stop wiring in production.
- `blog-admin/` – legacy admin panel. Replace with backend admin endpoints or future `/api/v1/posts` CRUD if needed.

We aligned the PR creation flow with the prior improvement (branching from default branch, `.rest` API, committer info). Comment archival is centralized in the backend and can be scheduled by calling `/api/v1/admin/archive-comments`.
