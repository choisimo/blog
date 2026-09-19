# MSpark-only blog text generation rollout

User requested replacing Codex Spark with MSpark for blog text generation after card exploration displayed a generic connection error.

## Verified cause

The backend process default was already `nodove-mspark-1.3c`, but the production Worker `/api/v1/internal/ai-config` returned `gpt-5.3-codex-spark`. The encrypted `AI_DEFAULT_MODEL` configuration took precedence over backend environment settings. The frontend card exploration request does not specify a model; the Gateway injects its default into the signed request to the backend.

## Changes

- Set the encrypted runtime default, Worker `AI_DEFAULT_MODEL` binding and `config:ai_default_model` KV value to `nodove-mspark-1.3c`.
- Set text model catalog routes to the MSpark Gateway provider and remove other text model fallbacks. Preserve embedding-only entries and provider credentials.
- Set backend, agent, query expansion and legacy model defaults to MSpark; `AI_FALLBACK_MODELS=[]` and legacy completions fallback disabled.
- Remove the obsolete Codex-specific stream aggregation path from the backend client.
- Update normal and optional terminal manifests and environment examples.
- Keep the existing OpenCode Go dual-key pool behind MSpark. This rollout changes model selection, not provider API keys or rotation behavior.
- Image generation and embedding model settings retain their separate task-specific configuration.

## Verification

- Node 20 focused tests: 8 pass, 0 fail. Includes canonical, legacy and dual-column model registry schemas, credential preservation, embedding preservation and no cross-model fallback after a rejection.
- Backend image workflow: 160 tests, 159 pass, 1 skipped, 0 fail.
- Terminal-server tests: 7 pass, 0 fail.
- First configuration workflow completed the writes but its immediate read observed an old cached model and failed. A subsequent production read returned `nodove-mspark-1.3c`. Follow-up PR adds bounded read-only convergence polling instead of repeating writes.
- Source PR: https://github.com/choisimo/blog/pull/194 (merged).
- Propagation verification PR: https://github.com/choisimo/blog/pull/195 (merged).
- Backend image build: https://github.com/choisimo/blog/actions/runs/35412812907 (success).
- Target runtime image: `ghcr.io/choisimo/blog-api:2a5bc70`.

## Rollback records

Before changes, resource snapshots were saved on `ssh -4 blog` under `~/releases/mspark-only-20260919/`. The prior API and worker image was `ghcr.io/choisimo/blog-api:601c3e8`.

The original model configuration rows, including the encrypted default, are stored privately on the API PVC at `/app/.data/private-mspark-20260919/model-config-before.json` (mode 0600). This backup is not committed. Restore only the affected settings and model rows when rolling back; never overwrite unrelated runtime state.

## Live acceptance

First acceptance request (2026-09-19 10:37:40–10:37:51 KST): anonymous authentication → chat session → public chat message returned HTTP 200, text/event-stream, MSPARK_OK text and a done event, with no error events. A probe during API pod replacement had returned HTTP 503 before session creation and did not reach model inference.

Final inspection found a live `blog-ai-legacy-completions-hotfix` ConfigMap mounting the old client file over the new image in both deployments. Removed only its obsolete Codex aggregation code; resulting SHA-256 matches the committed client exactly: `091ab33f4e2d6e505bc85f46d28496c09816cf997f6b81e15f5c45b434277b04`. The other mounted hotfix file was preserved. Saved its original ConfigMap alongside the other rollback resources.

The imported runtime model registry only had `litellm_model`, while the provider snapshot reads `model_identifier`, causing a 500 response. Added the canonical column and copied existing identifier values, retaining the legacy column. The configuration updater now fills both columns when both exist. The active registry contains only nodove-mspark-1.3c, and all four enabled routes point to it with empty fallback lists.

Final acceptance after hotfix reload (2026-09-19 10:42:17–10:42:31 KST): HTTP 200, text/event-stream, MSPARK_OK, session/text/done events and no errors. Both API and worker deployments are ready. Both mounted client files match the committed SHA-256 and contain no Codex Spark identifier.

The live internal configuration and provider snapshot endpoints both return HTTP 200. The default and the sole enabled text model are nodove-mspark-1.3c. The default route has no model fallbacks. The first public verification is independently recorded on ai-1 as openai/muse-spark-1.3-contributor, status success, 447 total tokens, through http://opencode-go-pool:8082/v1/responses.

The legacy schema compatibility and evidence follow-up is https://github.com/choisimo/blog/pull/196. No provider keys were changed.
