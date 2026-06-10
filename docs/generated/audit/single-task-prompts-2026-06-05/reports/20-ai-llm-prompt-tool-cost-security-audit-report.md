# 20. AI/LLM 기능 프롬프트 도구 호출 비용/보안 감사 - 실행 보고서

- 원본 프롬프트: `/home/nodove/workspace/secret/프롬프트/프로젝트_작업_프롬프트_라이브러리/single-task-prompts/20-ai-llm-prompt-tool-cost-security-audit.md`
- 대상 프로젝트: `/home/nodove/workspace/blog`
- 배포 검증 대상: `https://noblog.nodove.com`, `https://api.nodove.com`, SSH 대상 `blog`
- 작성일: 2026-06-05 KST
- 보고서 성격: 실제 코드/설정/테스트/배포 응답 기반 감사 보고서. 확인하지 못한 항목은 `[미확인]`으로 표시한다.

## 실행 증거 요약
| Gate | Result | Notes |
|---|---:|---|
| Deployed frontend HTTP | PASS | `https://noblog.nodove.com/` returned 200. |
| Deployed backend health/readiness | PASS | API readiness reported all required dependencies ok. |
| SSH backend connectivity | PASS | `ssh blog` reached host; k3s blog namespace inspected. |
| Browser E2E | PASS with residual symptoms | Main pages rendered; background aborts observed for RUM, analytics view, comments stream, translation, RAG during navigation. |
| Backend tests | PASS | 0 failures, 1 Redis integration skip. |
| Frontend typecheck/tests | PASS | TypeScript and Vitest passed. |
| Worker tests | PASS | Non-fatal workerd DNS warning. |
| Contract drift | PASS | `contracts:check` snapshot current. |
| Route governance | FAIL | `routes:check` reports route-governance snapshot drift. |
| npm audit backend | FAIL advisory gate | 8 prod advisories, high/moderate. |
| npm audit frontend | FAIL advisory gate | 29 prod advisories including critical/high. |

## 배포 E2E 클라이언트 검증
| Client Flow | Evidence |
|---|---|
| Home | `home.png`; H1 `ArchitectingIntelligence`; body length 1338. |
| Blog list | `blog-list.png`; H1 `Blog Posts`; body length 1920. |
| Blog search | Search query `kubernetes` produced 10 visible `/blog/` links; screenshot `blog-search-kubernetes.png`. |
| Manifest/post | Manifest reported 278 posts; first post `/blog/2026/argocd-github-dns-failure` loaded HTTP 200. |
| Projects | `projects.png`; H1 `Projects`; body length 4561. |
| About | `about.png`; H1 `About`; body length 2071. |
| Runtime config | Browser/API request returned production public config and feature flags. |
| Residual symptoms | 8 aborted background requests and 2 console issues captured; no page errors. |

## 0. AI 기능 위험 요약
- 판정: AI/RAG are enabled and healthy, but legacy fallback, cost controls, and model-eval evidence are incomplete.
- 분석 초점: AI/LLM/RAG/도구
- 기준 시스템: 현재 worktree + SSH `blog` k3s + 배포 사이트 `noblog.nodove.com`/`api.nodove.com`.
- 가장 중요한 공통 위험: route-governance drift, unresolved npm audit advisories, production browser background abort symptoms.

## 1. LLM Flow Map
- Public config reports default model `gpt-5-mini`, AI/RAG enabled, model selection disabled.
- RAG health reports embedding endpoint and Chroma ok.
- AI queue and worker tests cover fallback; production logs show legacy completions fallback.

## 2. Prompt/Context 구조
- Public config reports default model `gpt-5-mini`, AI/RAG enabled, model selection disabled.
- RAG health reports embedding endpoint and Chroma ok.
- AI queue and worker tests cover fallback; production logs show legacy completions fallback.

권장 작업:
1. Add eval dataset and golden prompts for summarization/chat/RAG.
2. Alert on legacy completions fallback rate and task latency.
3. Document tool permissions for agent, code execution, image generation, and RAG search.

## 3. Tool Calling 안전성
- Public config reports default model `gpt-5-mini`, AI/RAG enabled, model selection disabled.
- RAG health reports embedding endpoint and Chroma ok.
- AI queue and worker tests cover fallback; production logs show legacy completions fallback.

권장 작업:
1. Add eval dataset and golden prompts for summarization/chat/RAG.
2. Alert on legacy completions fallback rate and task latency.
3. Document tool permissions for agent, code execution, image generation, and RAG search.

## 4. RAG/데이터 접근 통제
| 항목 | 현재 확인 내용 | 근거 | 위험/공백 |
|---|---|---|---|
| 런타임 | Runtime topology is SPA frontend on `noblog.nodove.com`, Cloudflare Worker/API gateway on `api.nodove.com`, and k3s origin backend/service mesh in namespace `blog` behind Cloudflared/Traefik. The live API deployment image is `ghcr.io/choisimo/blog-api:04381b9` and pod readiness is healthy. | SSH/kubectl, readiness, frontend/API curl | route snapshot drift |
| 경계/계약 | The generated endpoint CSV contains 370 endpoint rows across backend and worker surfaces. Ownership is explicitly modeled in `shared/src/contracts/service-boundaries.js`, but the route governance snapshot is currently drifted. | endpoint-map CSV, shared service boundaries | OpenAPI authoritative status 보류 |
| 상태/저장소 | State stores found in code/runtime: Postgres for canonical analytics/logging, D1 for edge data/outbox/site content/comments/user state, Redis for queues/cache/SSE fan-out, ChromaDB for RAG vectors, R2/public filesystem for images/content, KV for worker auth/config/rate-limit flows, and SurrealDB for open-notebook. | readiness, docker/k3s config, source refs | restore/backfill 미검증 |
| 사용자 E2E | Home/blog/post/projects/about + API health/readiness pass | Playwright JSON/screenshots | background aborts |

## 5. 비용/성능/운영
| Gate | Result | Notes |
|---|---:|---|
| Deployed frontend HTTP | PASS | `https://noblog.nodove.com/` returned 200. |
| Deployed backend health/readiness | PASS | API readiness reported all required dependencies ok. |
| SSH backend connectivity | PASS | `ssh blog` reached host; k3s blog namespace inspected. |
| Browser E2E | PASS with residual symptoms | Main pages rendered; background aborts observed for RUM, analytics view, comments stream, translation, RAG during navigation. |
| Backend tests | PASS | 0 failures, 1 Redis integration skip. |
| Frontend typecheck/tests | PASS | TypeScript and Vitest passed. |
| Worker tests | PASS | Non-fatal workerd DNS warning. |
| Contract drift | PASS | `contracts:check` snapshot current. |
| Route governance | FAIL | `routes:check` reports route-governance snapshot drift. |
| npm audit backend | FAIL advisory gate | 8 prod advisories, high/moderate. |
| npm audit frontend | FAIL advisory gate | 29 prod advisories including critical/high. |

검증/운영 권장:
- Release gate에 `contracts:check`, `routes:check`, backend/frontend/worker tests, production smoke E2E, npm audit triage를 포함한다.
- Rollback 기준은 readiness degradation, 5xx spike, route boundary header mismatch, queue/DLQ growth, client E2E failure로 둔다.
- Incident triage는 public API readiness -> k3s pod status -> cloudflared logs -> queue/outbox stats 순서로 수행한다.

## 6. 평가 전략
- Public config reports default model `gpt-5-mini`, AI/RAG enabled, model selection disabled.
- RAG health reports embedding endpoint and Chroma ok.
- AI queue and worker tests cover fallback; production logs show legacy completions fallback.

권장 작업:
1. Add eval dataset and golden prompts for summarization/chat/RAG.
2. Alert on legacy completions fallback rate and task latency.
3. Document tool permissions for agent, code execution, image generation, and RAG search.

## 핵심 Findings
- Public config reports default model `gpt-5-mini`, AI/RAG enabled, model selection disabled.
- RAG health reports embedding endpoint and Chroma ok.
- AI queue and worker tests cover fallback; production logs show legacy completions fallback.

## 권장 액션
1. Add eval dataset and golden prompts for summarization/chat/RAG.
2. Alert on legacy completions fallback rate and task latency.
3. Document tool permissions for agent, code execution, image generation, and RAG search.

## 검증된 출처 및 명령
- `curl -sS -D - https://noblog.nodove.com/` => HTTP 200, Cloudflare/GitHub Pages frontend shell served.
- `curl -sS https://api.nodove.com/api/v1/healthz` => `{ ok: true, status: "ok", env: "production" }`.
- `curl -sS https://api.nodove.com/api/v1/readiness` => ready; postgres, redis, d1, chroma, ai, worker, domain_outbox all `ok`; domain outbox storage `d1`, deadLetter 0, stuck 0.
- `curl -sS https://api.nodove.com/api/v1/public/config` => production config uses `siteBaseUrl=https://noblog.nodove.com`, `apiBaseUrl=https://api.nodove.com`, AI/RAG/comments enabled, terminal/code execution disabled.
- `ssh blog kubectl get pods -n blog -o wide` => api, ai-worker(2), cloudflared(2), postgres, redis, chromadb, open-notebook, piston, surrealdb all Running.
- `ssh blog kubectl exec -n blog deploy/api -- wget -qO- http://127.0.0.1:5080/api/v1/readiness` => direct in-pod readiness ready with the same dependency checks.
- `ssh blog kubectl exec -n blog deploy/api -- wget -qO- http://127.0.0.1:5080/api/v1/public/config` => 401 Unauthorized, proving origin public config is gated by gateway signature when bypassing the worker.
- `node Playwright deployed-client-e2e` => PASS; home, blog, first manifest post, projects, about rendered; blog search for `kubernetes` exposed 10 blog links; API public config/health/readiness returned 200.
- Saved E2E evidence: `docs/generated/audit/single-task-prompts-2026-06-05/evidence/deployed-client-e2e.json` and screenshots under `evidence/screenshots/`.
- `npm run contracts:check` => pass; `npm run routes:check` => fail, route-governance snapshot drift; `npm run routes:check:orphans` => pass.
- `npm test` in `backend` => 63 subtests / 65 tests reported, 64 pass, 1 skip, 0 fail.
- `npm run type-check` in `frontend` => pass; `npm run test:run` in `frontend` => 47 files, 183 tests, all pass.
- `npm test` in `workers/api-gateway` => 33 files, 113 tests, all pass; workerd logged a non-fatal `backend.example` DNS warning.
- `npm audit --omit=dev --json` in `backend` => 8 prod advisories: 3 high, 5 moderate.
- `npm audit --omit=dev --json` in `frontend` => 29 prod advisories: 2 critical, 9 high, 17 moderate, 1 low.
- `wc -l docs/generated/audit/endpoint-map-full.csv` => 371 lines, i.e. 370 endpoint rows plus header.

## 코드/설정 근거
- `backend/src/index.js:204-397` Express startup, readiness, route mounting, gateway signature, metrics, graceful shutdown, outbox worker.
- `backend/src/routes/registry.js:1-83` backend route registry and boundary headers.
- `workers/api-gateway/src/index.ts:267-476` worker middleware, health/readiness proxy, public config, route registration, cron scheduler.
- `workers/api-gateway/src/routes/registry.ts:1-113` worker route registry and proxyability rules.
- `shared/src/contracts/service-boundaries.js:1-136` route/service ownership and explicit backend-vs-worker boundaries.
- `frontend/src/App.tsx:156-338` feature flags, heartbeat, notification SSE gating, public/admin route table.
- `frontend/src/utils/network/apiBase.ts:39-128` runtime API base resolution and production fail-closed behavior.
- `frontend/src/services/content/analytics.ts:72-180` analytics view/stats/editor-picks/trending client calls.
- `backend/src/services/ai/task-queue.service.js:1-374` Redis stream AI queue, retries, DLQ, queue stats.
- `backend/src/services/backend-outbox.service.js:561-632` backend domain outbox claim/process/mark and interval worker.
- `backend/docker-compose.yml:37-320` local service topology for API, Redis, Postgres, ChromaDB, open-notebook, Piston.
- `k3s/ingress.yaml:1-23` production Traefik ingress for `api.nodove.com`.
- `frontend/playwright.config.ts:1-18` Playwright config for E2E runner.
- `frontend/e2e/live-chat.spec.ts:1-220` existing live-chat E2E spec uses stubs for live endpoints, not production.
- `docs/generated/audit/endpoint-map-full.csv` endpoint map, 370 endpoint rows.

## 미확인 및 잔여 리스크
- 실제 운영 데이터에 대한 destructive write/delete/restore drill은 실행하지 않았다.
- Admin-authenticated browser E2E, real comment mutation, file upload mutation, billing flow는 이 run에서 실행하지 않았다.
- npm audit advisories는 현재 시점의 registry 결과이므로 패키지 업데이트 후 재검증해야 한다.
- Route governance drift가 해결되기 전에는 endpoint map과 OpenAPI 산출물을 최종 계약으로 사용하면 안 된다.
