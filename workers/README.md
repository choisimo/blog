# Blog API - Cloudflare Workers

Serverless backend for the blog, built with Cloudflare Workers, D1, R2, and KV.

## Architecture

- **Runtime**: Cloudflare Workers (Edge)
- **Router**: Hono.js (lightweight, fast)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Cache/Config**: Cloudflare KV
- **AI**: Google Gemini API (proxied through Workers)

## Features

- ✅ Posts CRUD (with tags)
- ✅ Comments system
- ✅ JWT authentication
- ✅ AI-powered content analysis (sketch, prism, chain)
- ✅ Image upload to R2
- ✅ OG image generation (SVG)
- ✅ CORS middleware
- ✅ Structured logging
- ✅ Type-safe with TypeScript

## Prerequisites

- Node.js >= 20
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account with Workers, D1, R2, KV enabled

## Setup

### 1. Install dependencies

```bash
cd workers
npm install
```

### 2. Create Cloudflare resources

```bash
# D1 database (dev)
wrangler d1 create blog-db-dev

# D1 database (prod)
wrangler d1 create blog-db-prod

# R2 bucket (dev)
wrangler r2 bucket create blog-assets-dev

# R2 bucket (prod)
wrangler r2 bucket create blog-assets-prod

# KV namespace (dev)
wrangler kv:namespace create KV

# KV namespace (prod)
wrangler kv:namespace create KV --env production
```

### 3. Update `wrangler.toml`

Fill in the `database_id` and `id` fields for D1 and KV from the output of the above commands.

### 4. Configure secrets

Copy `.dev.vars.example` to `.dev.vars` and fill in your secrets:

```bash
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your actual values
```

For production, set secrets via Wrangler:

```bash
wrangler secret put JWT_SECRET --env production
wrangler secret put GEMINI_API_KEY --env production
wrangler secret put ADMIN_USERNAME --env production
wrangler secret put ADMIN_PASSWORD --env production
```

### 5. Apply database migrations

```bash
# Local dev
npm run migrations:apply

# Production
npm run migrations:apply:prod
```

## Development

```bash
npm run dev
```

This starts the local development server at `http://localhost:8787`.

## Deployment

### Manual deployment

```bash
# Deploy to dev
npm run deploy

# Deploy to production
npm run deploy:prod
```

### Automatic deployment (GitHub Actions)

The `.github/workflows/deploy-workers.yml` workflow automatically deploys to production when changes are pushed to `main` branch under `workers/` directory.

Required GitHub Secrets:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Auth

- `POST /auth/login` - Admin login (returns JWT)
- `GET /auth/me` - Get current user info

### Posts

- `GET /posts` - List posts (query: `status`, `limit`, `offset`, `tag`)
- `GET /posts/:slug` - Get single post
- `POST /posts` - Create post (admin)
- `PUT /posts/:slug` - Update post (admin)
- `DELETE /posts/:slug` - Delete post (admin)

### Comments

- `GET /comments?postId=xxx` - Get comments for post
- `POST /comments` - Create comment
- `DELETE /comments/:id` - Delete comment (admin)

### AI

- `POST /ai/sketch` - Generate emotional sketch
- `POST /ai/prism` - Generate idea facets
- `POST /ai/chain` - Generate follow-up questions
- `POST /ai/generate` - Generic AI generation

### Images

- `POST /images/presign` - Get presigned upload URL (admin)
- `POST /images/upload-direct` - Direct upload to R2 (admin)
- `DELETE /images/:key` - Delete image (admin)

### OG

- `GET /og?title=xxx&subtitle=xxx` - Generate OG image (SVG)

### Health

- `GET /healthz` - Health check
- `GET /public/config` - Public configuration

## Migration from Express Backend

This Workers implementation replaces the previous Docker/VM-based Express backend. Key differences:

1. **Firestore → D1**: NoSQL to SQL migration required
2. **File system → R2**: All uploads now go to R2
3. **Environment**: Serverless edge runtime (no Node.js APIs like `fs`, `path`)
4. **JWT**: Custom implementation using Web Crypto API
5. **No SSE**: Comments streaming removed (can be added with Durable Objects)

See `docs/PRD-serverless-migration.md` for full migration plan.

## Testing

```bash
# Type check
npm run typecheck

# E2E tests (after deployment)
# See ../scripts/e2e-workers.sh
```

## Troubleshooting

### Error: "database not found"

Make sure you've created the D1 database and applied migrations:

```bash
wrangler d1 create blog-db-dev
npm run migrations:apply
```

### Error: "binding not found"

Check that `wrangler.toml` has correct `database_id` and namespace `id` values.

### CORS issues

Verify `ALLOWED_ORIGINS` in `wrangler.toml` or `.dev.vars` includes your frontend URL.

## Performance

- Cold start: ~50ms
- Warm response (cached): ~20ms
- P95 response time: <100ms (non-AI endpoints)

## Cost Estimate

With Cloudflare Free tier:
- Workers: 100k requests/day free
- D1: 5M reads, 100k writes/day free
- R2: 10GB storage, 10M reads/month free
- KV: 100k reads, 1k writes/day free

Expected monthly cost: **$0** (within free tier for typical blog traffic)

## License

MIT
