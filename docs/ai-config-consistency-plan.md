# AI Config Consistency Plan

## Goal

Remove split-brain behavior in AI configuration by defining:

- one authoritative control plane
- one canonical meaning for each key namespace
- one secret resolution path for backend and Workers

This document covers:

1. Canonical decisions
2. Patch inventory for implementation

## Canonical Decisions

### 1. Authoritative admin/control plane

The Worker API is the only mutable admin/control plane for AI provider configuration.

- Authoritative admin API: `workers/api-gateway` under `/api/v1/admin/ai`
- Authoritative mutable stores:
  - D1 for providers, models, routes, and secret metadata
  - centralized secrets table for secret values
  - KV for runtime overrides such as default model and base URL

The backend must become a config consumer, not a second config editor.

- Backend `GET/POST/PUT /api/v1/admin/ai/*` should be removed, deprecated, or changed into a proxy to Worker admin APIs
- Backend must not treat its local SQLite copy as the source of truth for mutable AI config

### 2. Canonical key namespaces

`AI_*` means deployment-level default OpenAI-compatible gateway settings.

These keys are for the default gateway path and fallback client:

- `AI_SERVER_URL`
- `AI_API_KEY`
- `AI_DEFAULT_MODEL`
- `AI_VISION_MODEL`
- `AI_EMBEDDING_URL`
- `AI_EMBEDDING_API_KEY`
- `AI_EMBED_MODEL`

Provider-specific keys use provider-native names.

Examples:

- `OPENAI_API_KEY` for direct OpenAI provider
- `GITHUB_TOKEN` for GitHub Models provider
- `ANTHROPIC_API_KEY` for Anthropic provider
- `OPENROUTER_API_KEY` for OpenRouter provider

### 3. Meaning of `AI_API_KEY` vs `OPENAI_API_KEY`

`AI_API_KEY` is the key for `AI_SERVER_URL`.

- It is not the canonical key for direct OpenAI provider credentials
- It is used by the Worker internal config path, backend fallback OpenAI-compatible client, and Open Notebook wiring

`OPENAI_API_KEY` is the key for direct calls to `https://api.openai.com/v1`.

- `prov_openai` must use `OPENAI_API_KEY`
- if backward compatibility is needed, `OPENAI_API_KEY` may remain as a deprecated backend env fallback alias for one migration window, but it must not remain semantically ambiguous

### 4. Required backend-to-Worker sync

If backend dynamic config remains enabled, `WORKER_API_URL` is required.

- backend dynamic config should fetch from Worker internal endpoints
- if `WORKER_API_URL` is missing, startup should warn loudly or fail fast depending on environment
- documentation and deploy templates must include it

### 5. One secret resolution path

Secret resolution for provider credentials must be identical in backend and Worker.

Canonical order:

1. provider `secret_id`
2. referenced `secrets.key_name`
3. secret value from centralized secrets store
4. environment fallback named by `env_fallback`

The backend must stop using `process.env[provider.api_key_env]` as the only provider secret source.

### 6. Model capability rules

Chat and generation routes must never fall through to embedding-only models.

Immediate rule:

- exclude models with `max_tokens = 0` from chat/generate fallback chains

Longer-term rule:

- add an explicit `supports_chat` capability and select by request type

### 7. Terminology cleanup

Backend code currently uses a local SQLite database via `better-sqlite3` while naming it "D1".

Canonical wording:

- Worker: real Cloudflare D1
- backend: local SQLite mirror or local config cache

Do not describe backend local SQLite as the authoritative D1 control plane.

## Patch Inventory

## P0 - Unify control plane

### Backend admin API deprecation

Files:

- `backend/src/index.js`
- `backend/src/routes/aiAdmin.js`

Changes:

- remove or deprecate backend-mounted `/api/v1/admin/ai`
- if local development still needs the route, make it a proxy to Worker admin APIs instead of a second mutable implementation

Reason:

- frontend already targets `${API_BASE}/api/v1/admin/ai`
- Worker already exposes the authoritative admin route
- keeping both routes guarantees drift

### Backend provider config consumption

Files:

- `backend/src/services/ai/multi-provider.service.js`
- `backend/src/services/ai/dynamic-config.service.js`
- `workers/api-gateway/src/routes/internal.ts`

Changes:

- stop resolving provider auth with `process.env[provider.api_key_env]`
- add a Worker internal endpoint for provider/model/route snapshot with resolved secret references, or equivalent signed config snapshot
- make backend multi-provider consume that snapshot instead of local SQLite as the authoritative mutable config

Reason:

- Worker secrets logic already resolves `secret_id -> secrets`
- backend currently reads local DB rows but bypasses centralized secret resolution

## P0 - Make Worker sync mandatory and visible

Files:

- `backend/.env.example`
- `backend/README.md`
- `backend/docker-compose.yml`
- `backend/scripts/setup-secrets.sh`
- `backend/scripts/setup-github-secrets.sh`
- `backend/src/config/schema.js`
- `backend/src/services/ai/dynamic-config.service.js`

Changes:

- add `WORKER_API_URL` to env example, README, setup scripts, and deploy templates
- add local default wiring for compose-based development
- log a startup warning or fail fast when dynamic config is expected but `WORKER_API_URL` is missing

Reason:

- backend code already depends on `WORKER_API_URL`
- current templates do not surface it, so deployments silently fall back to env and drift

## P1 - Normalize key ownership

### OpenAI provider key mapping

Files:

- `workers/migrations/0012_ai_model_seed.sql`
- `workers/migrations/0015_secrets_seed.sql`
- new migration file under `workers/migrations/`

Changes:

- change seeded `prov_openai.api_key_env` from `AI_API_KEY` to `OPENAI_API_KEY`
- change OpenAI provider `secret_id` linkage from `sec_ai_api_key` to `sec_openai_api_key`
- write a forward migration that updates existing rows safely in deployed databases

Reason:

- `AI_API_KEY` belongs to the default OpenAI-compatible gateway
- `OPENAI_API_KEY` should represent direct OpenAI provider credentials

### Backend fallback alias policy

Files:

- `backend/src/config/index.js`
- `backend/src/config/schema.js`
- `backend/.env.example`
- `backend/README.md`

Changes:

- keep `AI_API_KEY` as the canonical default gateway key
- keep `OPENAI_API_KEY` only as an explicitly documented deprecated fallback alias if backward compatibility is needed
- add a deprecation note in docs and comments

Reason:

- prevents operators from assuming `OPENAI_API_KEY` drives the whole system

## P1 - Fix UI guidance

Files:

- `frontend/src/components/features/admin/ai/providerCatalog.ts`
- `frontend/src/components/features/admin/ai/ProvidersManager.tsx`
- `frontend/src/components/features/admin/secrets/SecretsListManager.tsx`
- `workers/api-gateway/src/routes/secrets.ts`

Changes:

- keep the OpenAI catalog entry provider-specific as `OPENAI_API_KEY`
- change generic placeholders from `OPENAI_API_KEY` to neutral examples such as `PROVIDER_API_KEY` or `SERVICE_API_KEY`
- update validation and help text so generic secret creation does not imply OpenAI is the default key for every path

Reason:

- current UI nudges operators toward the wrong key during setup and rotation

## P1 - Align comments and docs with runtime behavior

Files:

- `backend/src/services/ai/openai-client.service.js`
- `backend/src/services/ai/ai.service.js`
- `backend/README.md`
- `workers/api-gateway/README.md`

Changes:

- update comments that currently describe a single OpenAI-compatible path
- document actual runtime layering:
  - Worker admin/config plane
  - backend dynamic config consumption
  - multi-provider routing
  - env fallback only when control-plane sync is unavailable

Reason:

- current comments describe a simpler system than the code actually runs

## P1 - Clarify backend SQLite terminology

Files:

- `backend/src/repositories/base/d1.repository.js`
- `backend/src/routes/aiAdmin.js`
- `backend/README.md`

Changes:

- stop presenting backend local SQLite as Cloudflare D1
- rename documentation and comments to "local SQLite mirror" or equivalent

Reason:

- current naming hides the fact that backend and Worker can diverge

## P2 - Make fallback chains request-type aware

Files:

- `backend/src/services/ai/multi-provider.service.js`
- `workers/migrations/0012_ai_model_seed.sql`
- new migration file under `workers/migrations/`

Changes:

- exclude `max_tokens = 0` models from chat/generate fallback chains immediately
- seed at least one chat-capable direct OpenAI model if `prov_openai` remains enabled for chat fallback
- optionally add `supports_chat` for explicit capability filtering

Reason:

- current route construction can eventually fall through to an embedding-only model

## P2 - Remove implicit provider auth shortcuts

Files:

- `workers/api-gateway/src/routes/chat.ts`

Changes:

- review and likely remove implicit `GITHUB_TOKEN` Authorization injection for generic backend chat proxying
- let backend provider routing own provider authentication

Reason:

- generic proxy auth shortcuts are a second, implicit configuration plane

## Recommended rollout order

1. P0 control-plane unification
2. P0 `WORKER_API_URL` deployment wiring
3. P1 key ownership migration for `prov_openai`
4. P1 UI/doc cleanup
5. P2 model capability cleanup

## Non-goals for the first patch set

- full provider-health redesign
- replacing all env fallbacks immediately
- changing user-facing admin UX beyond key naming and guidance

