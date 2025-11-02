# PRD: AI Chat Bot Image Attachment & Catalyst Unification (1102)

- **Author**: Cascade (AI assistant)
- **Date**: 2025-11-02
- **Status**: Draft / For Review
- **Related initiative**: AI Chat Bot multimodal upgrade & Catalyst inline AI 강화

---

## 1. Background & Problem Statement

We are upgrading the Nodove AI Chat bot to accept user-uploaded images (leveraging GPT-4.1 image understanding) while continuing the Catalyst/Spark refactor. Today:

- Chat widget supports text-only prompts streaming via `/api/v1/chat`, lacking a structured attachment pipeline.
- Catalyst inline helpers still hit legacy `/api/v1/ai/*` routes, creating duplicated logic and uneven telemetry.
- Floating memo and inline tools do not surface a consistent attachment UX, making future reuse harder.

The immediate priority is a production-ready image-attachment workflow for the AI Chat bot, then extending the same infrastructure to Catalyst/Spark so both experiences converge on a unified task API.

## 2. Goals

1. Deliver image attachment support in the AI Chat bot (web) with GPT-4.1 analysis, including upload, preview, and streaming response UX.
2. Reuse the same unified chat task infrastructure for Catalyst/Spark to avoid duplicated fetch logic and to unlock multimodal prompts later.
3. Refresh Catalyst inline UX (non-blocking loader, toast errors) without regressing recently refactored memo layout.
4. Maintain or improve response time, reliability, and telemetry with attachment metadata.

## 3. Non-Goals

- Supporting image editing or drawing (attachments are read-only inputs).
- Changing provider beyond GPT-4.1; prompt tweaks are limited to enabling multimodal context.
- Replacing recently refactored memo layout or history export/import flows.

## 4. Current State Summary

- Chat widget (`ChatWidget.tsx`) consumes `streamChatEvents` for text prompts only; no attachment schema exists.
- `frontend/src/services/chat.ts` now exposes `invokeChatTask` behind the `aiUnified` flag, but callers still pass text payloads.
- Catalyst (`frontend/public/ai-memo/ai-memo.js`) invokes `/api/v1/ai/summarize`; SparkInline (`frontend/src/services/ai.ts`) now routes through `invokeChatTask` when enabled but lacks image awareness.
- Worker/Backend: `/api/v1/chat/session/:id/message` proxied by `workers/src/routes/chat.ts`; `/api/v1/ai/*` routes remain for legacy clients.
- No shared attachment storage or upload policy. Browser drag-drop/upload logic is absent.

## 5. User Stories & Acceptance Criteria

### Story A1 – AI Chat bot image attachments (Priority P0)

- **Role**: blog visitor chatting with GPT-4.1 bot
- **Goal**: upload 1–3 supporting images, receive multimodal responses inline
- **Benefit**: richer answers for visual questions, parity with GPT product expectations

#### Acceptance Criteria (Chat Attachments)

1. Chat composer exposes an “이미지 추가” button and drag-drop zone (desktop + mobile) with thumbnail previews and remove controls.
2. Attachments validate type (`image/png`, `image/jpeg`, `image/webp`) and size (<= 4 MB each); failure surfaces inline error + toast.
3. `invokeChatTask` payload includes `attachments: [{ id, mimeType, dataURL|signedUrl, width, height }]` when flag enabled.
4. Worker proxy forwards attachment metadata (and uploads if required) to the upstream GPT-4.1 gateway.
5. Streaming response UI indicates when image analysis is in progress (e.g., status chip) and falls back gracefully on failure.

### Story C1 – Unified API endpoint for Catalyst & Spark (P1)

- **Role**: developer maintaining AI features
- **Goal**: route Catalyst/Spark requests through the same chat task contract used by the chat bot
- **Benefit**: consistent auth, future multimodal extension, central telemetry

#### Acceptance Criteria (Catalyst & Spark API)

1. SparkInline (`sketch/prism/chain`) and Catalyst run calls use `invokeChatTask` with `mode` + optional `attachments`.
2. Worker `ai.ts` becomes thin shim or is removed; `/api/v1/chat` handles all AI tasks.
3. Shared JSON schema documented (mode, prompt, payload, attachments) and referenced by both frontends.
4. Regression smoke: chat bot + SparkInline + Catalyst succeed under unified flag.

### Story C2 – Catalyst UX modernization (P1)

- **Role**: AI memo user
- **Goal**: experience subtle inline loading and toast-based feedback when Catalyst runs (with optional images later)
- **Benefit**: preserves editing flow, matches new chat UX

#### Acceptance Criteria (Catalyst UX)

1. Catalyst button shows pulse loader and disables duplicate submissions.
2. Toast component displays success/error; no blocking modal.
3. Optional attachments preview reuses chat thumbnail component when available.
4. Busy state keeps memo editable; layout responsive in split/tab modes.

### Story C3 – Observability & telemetry (P1)

- **Role**: product analyst
- **Goal**: measure multimodal usage across chat and Catalyst
- **Benefit**: consistent analytics for product decisions

#### Acceptance Criteria (Telemetry)

1. `logEvent` records `chat_attach_add/remove`, `chat_attach_fail`, `chat_multimodal_response` with payload sizes & latency.
2. Catalyst events log `attachmentsCount` and `attachmentBytes` when present.
3. Worker emits structured logs with request IDs & attachment metadata (no inline image contents).
4. Documentation updated (Notion + repo `docs/metrics.md`).

## 6. Functional Requirements

1. **Attachment ingestion**: client-side compression (<= 2048px longest edge), EXIF strip, and Base64 or Blob upload before task invocation.
2. **API schema**: extend `invokeChatTask` request to include attachments array; update TypeScript types.
3. **Gateway proxy**: worker handles multipart/form-data or signed URL fetch to upstream GPT-4.1 endpoint.
4. **Fallback**: when `aiUnified` flag disabled or browser unsupported, hide attachment UI and continue text-only flow.
5. **Reuse**: Catalyst/Spark adopt same attachment serializer once P0 released.

## 7. UX & Visual Guidelines

- Chat composer: attachment button uses rounded icon button (align with existing send button). Thumbnails appear above input with removable chips.
- Drag-drop overlay: dark translucent sheet with “이미지를 여기에 놓으세요” copy.
- Loading: thumbnail displays spinner overlay until upload completes; send button disabled during upload.
- Chat transcript: first assistant message acknowledges attachments (“첨부 이미지를 분석 중입니다…”).
- Catalyst (future P1): reuses chat thumbnail component inside memo panel; toast copy localized (“이미지 분석 실패” 등).

## 8. Technical Notes

- Prefer Blob URL uploads stored temporarily; convert to Base64 only if upstream requires inline payload.
- Apply rate limiting per session when attachments present (configurable server-side throttle).
- Chat bot UI lives in React app; use Zustand/Context store to manage attachments (clear after send).
- Shadow DOM memo (Catalyst) cannot reuse React components directly; expose lightweight web component variant after P0.
- Ensure CSP headers allow data URLs or signed storage domain for images.

## 9. Analytics / Telemetry

- Record upload latency, file size distribution, and error codes in local events + optional analytics endpoint.
- Instrument worker with structured logs capturing attachment counts & MIME types.
- Generate weekly dashboard slice comparing text-only vs multimodal sessions.

## 10. Dependencies / Risks

- GPT-4.1 endpoint must accept our attachment schema; fallback path required if quota/location issues occur.
- Browser memory usage may spike with large images; need client-side resizing.
- Signed URL storage (if used) introduces storage billing & cleanup policies.
- Feature flag & QA coverage must guard against regression in legacy browsers.

## 11. QA Checklist

- ✅ Chat bot: upload/remove multiple images, mobile safari + chrome.
- ✅ GPT-4.1 response includes image reasoning tokens; fallback message when analysis disabled.
- ✅ Catalyst/Spark text-only flow remains functional behind flag.
- ✅ Dark mode alignment for thumbnails, drag overlay, memo preview.
- ✅ Accessibility: keyboard navigation, screen reader labels for attachments.

## 12. Rollout Plan

1. Implement chat attachments hidden behind `window.__APP_CONFIG.aiUnifiedAttachments`.
2. Internal QA with GPT-4.1 sandbox credentials; monitor logs.
3. Gradual beta rollout (10% traffic) after final load testing.
4. Expand to Catalyst/Spark once chat metrics stable; retire legacy `/api/v1/ai/*` routes.
5. Provide rollback toggle per feature flag.

## 13. Open Questions

1. Will GPT-4.1 respond synchronously with images, or do we need polling for analysis readiness?
2. Should attachments persist in chat history exports/downloads?
3. What retention policy applies to uploaded images on server/storage?
4. How quickly can Catalyst adopt multimodal prompts after chat launch?

---

## Appendix C – Reference Artifacts

- SparkInline component: `frontend/src/components/features/sentio/SparkInline.tsx`
- Chat service client: `frontend/src/services/chat.ts`
- Legacy AI client: `frontend/src/services/ai.ts`
- Worker routes: `workers/src/routes/chat.ts`, `workers/src/routes/ai.ts`
- Floating memo script: `frontend/public/ai-memo/ai-memo.js`
