# PRD: Catalyst (Sentio/Spark Inline) API & UX Refactor (1102)

- **Author**: Cascade (AI assistant)
- **Date**: 2025-11-02
- **Status**: Draft / For Review
- **Related initiative**: Catalyst inline AI 강화

---

## 1. Background & Problem Statement

The in-article inline AI helpers (SparkInline / Sentio) currently call a dedicated `/api/v1/ai` route via `frontend/src/services/ai.ts`, while the chat widget relies on `/api/v1/chat`. The backend duplicates logic across `workers/src/routes/ai.ts` and `workers/src/routes/chat.ts`, complicating maintenance and telemetry. UX feedback highlights a blocking modal and heavy spinner for Catalyst runs inside the floating memo, leading to workflow interruptions and noisy error handling (alerts).

## 2. Goals

1. Consolidate Catalyst/Spark inline requests onto the chat streaming infrastructure (single endpoint family) for parity and reuse.
2. Simplify frontend service clients so both chat and Catalyst consume a common request abstraction.
3. Refresh inline UX with non-intrusive loading and toast-based error reporting.
4. Maintain or improve response time and reliability while enabling richer analytics.

## 3. Non-Goals

- Replacing the language model provider or prompt structure wholesale (beyond adjustments needed for compatibility).
- Overhauling the floating memo layout (covered separately).
- Modifying long-term history export/import features.

## 4. Current State Summary

- Catalyst calls `POST /api/v1/ai/summarize` from Shadow DOM script (`frontend/public/ai-memo/ai-memo.js`).
- SparkInline component uses `sketch`, `prism`, `chain` helpers in `frontend/src/services/ai.ts` that hit `/api/v1/ai/generate`.
- Chat widget streams via `streamChatEvents` in `frontend/src/services/chat.ts` → `/api/v1/chat/session/:id/message` proxied by workers `chat.ts`.
- Worker route `workers/src/routes/ai.ts` contains bespoke logic; `routes/chat.ts` proxies upstream gateway with auth headers.
- Errors surfaced through `alert()` or inline text; Catalyst spinner is a large modal overlay.

## 5. User Stories & Acceptance Criteria

### Story C1 – Unified API endpoint

- Role: developer maintaining AI features
- Goal: route all Catalyst/Spark requests through the chat service contract
- Benefit: consistent auth, logging, and throttling

#### Acceptance criteria – API unification

1. Spark inline functions invoke new chat-oriented helper (e.g., `invokeAiTask`) that targets `/api/v1/chat/...`.
2. Worker route `ai.ts` removed or reduced to proxy stubs; `/api/v1/chat` handles Catalyst payloads.
3. Request/response JSON schema documented and shared between chat and Catalyst callers.
4. Regression tests or smoke scripts confirm both chat widget and Catalyst flows succeed.

### Story C2 – Frontend client refactor

- Role: frontend engineer
- Goal: reduce duplicate fetch logic across `services/chat.ts` and `services/ai.ts`
- Benefit: easier future maintenance and error handling standardization

#### Acceptance criteria – client refactor

1. Shared utility (e.g., `invokeChatTask`) handles auth headers, session, and streaming (where applicable).
2. SparkInline `sketch/prism/chain` functions migrate to new utility; legacy endpoints removed.
3. TypeScript typings updated; unused exports cleaned.
4. Unit/integration coverage updated to reflect new services.

### Story C3 – Catalyst UX modernization

- Role: AI memo user
- Goal: experience subtle inline loading and toasts instead of a modal spinner
- Benefit: preserves editing flow and reduces cognitive load

#### Acceptance criteria – Catalyst UX

1. Catalyst button shows pulse/loader state; no blocking modal appears.
2. Toast component (existing shadow toast or new mini toast) displays success/error messages.
3. Error states no longer use `alert`; promise rejections surface through toast + status text.
4. Busy state prevents duplicate submissions but keeps memo editable.

### Story C4 – Observability & telemetry

- Role: product analyst
- Goal: track Catalyst usage via unified events
- Benefit: consistent analytics across chat and inline features

#### Acceptance criteria – telemetry

1. `logEvent` (localStorage) or analytics pipeline logs event type `catalyst_invoke` / `catalyst_error` with prompt length and response time.
2. Backend logs or metrics note route usage (e.g., structured logs in worker).
3. Documentation updated for event taxonomy.

## 6. Functional Requirements

1. Extend chat service to accept task-specific metadata (e.g., `mode: 'catalyst' | 'sketch' | 'prism' | 'chain'`).
2. Provide optional streaming vs non-streaming handling (Spark results may remain JSON summarizations; choose best approach).
3. Ensure authentication headers and gateway keys applied consistently (see `workers/src/routes/chat.ts`).
4. Update Shadow DOM script to consume new API wrapper via postMessage or exposed bridge function.
5. Guarantee backwards compatibility fallback (feature flag) during rollout.

## 7. UX & Visual Guidelines

- Loading: Spark icons pulse with `animation: pulse 1.2s infinite` while disabled state retains affordance.
- Toast style: reuse existing `.toast` element in memo; add variants for error (red) vs success (green).
- Inline content insertion: maintain subtle highlight (e.g., transient background color) when Catalyst adds text.
- Copywriting: success message "Catalyst 결과가 메모에 추가되었습니다."; error "Catalyst 생성 중 오류가 발생했습니다.".

## 8. Technical Notes

- Shadow DOM limitations require direct script updates in `ai-memo.js`; avoid relying on React components there.
- Worker proxies must forward streaming responses correctly; test with `fetch` streaming readers.
- Consider environment variable `AI_SERVE_API_KEY` for Catalyst parity with chat route.
- Coordinate with AI gateway team regarding new payload schema for Catalyst-specific prompts.

## 9. Analytics / Telemetry

- Record request latency (start/end timestamps) on frontend and send to `logEvent`.
- Backend logs include `X-Request-ID` to correlate requests.
- Optional: send aggregated counts to existing analytics endpoint if available.

## 10. Dependencies / Risks

- Upstream AI gateway must support new payload shapes; risk of incompatibility.
- Transition period may break existing clients if not feature-flagged.
- Shadow DOM updates are harder to test; require manual QA in multiple browsers.
- Potential bundle size impact if new shared client pulls additional dependencies.

## 11. QA Checklist

- ✅ SparkInline (Sketch/Prism/Chain) returns valid content via new endpoint.
- ✅ Catalyst run in memo succeeds, shows loader, and inserts response.
- ✅ Error case (force network failure) surfaces toast message without alert.
- ✅ Chat widget unaffected by refactor (smoke test send/receive).
- ✅ Dark mode styling remains consistent.

## 12. Rollout Plan

- Stage behind feature flag or config (e.g., `window.__APP_CONFIG.aiUnified = true`).
- Gradually enable for internal testers before public release.
- Provide rollback path via config switch.

## 13. Open Questions

1. Should Catalyst leverage streaming responses for progressive rendering?
2. How to handle large JSON payloads from Spark (pagination vs collapse)?
3. Do we need rate limiting per user for Catalyst usage?

---

## Appendix C – Reference Artifacts

- SparkInline component: `frontend/src/components/features/sentio/SparkInline.tsx`
- Chat service client: `frontend/src/services/chat.ts`
- Legacy AI client: `frontend/src/services/ai.ts`
- Worker routes: `workers/src/routes/chat.ts`, `workers/src/routes/ai.ts`
- Floating memo script: `frontend/public/ai-memo/ai-memo.js`
