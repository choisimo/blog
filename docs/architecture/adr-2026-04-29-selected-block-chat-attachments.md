# ADR: Selected Block Chat Attachments

## Context

The selected-block flow currently converts a captured block into a large prompt string in `frontend/public/ai-memo/ai-memo.js` and sends it through `aiMemo:askSelectedBlock`. React receives that event in `frontend/src/components/features/memo/fab/hooks/useSelectedBlockActions.ts` and opens `ChatWidget` with `initialMessage`. The chat transport in `frontend/src/services/chat/types.ts` only models `{ type: "text" }` content parts, while backend extraction in `backend/src/lib/chat-streaming.js` treats every text part as the user message.

This makes the screenshot target hard to implement: `selected-block.md` cannot be shown as a removable composer attachment, raw selected content is persisted as user text, and backend RAG query derivation is polluted by context text.

## Decision

Represent selected content as a structured virtual attachment:

- `SelectedBlockAttachment` is defined at the chat service contract layer.
- DOM selection code normalizes legacy event payloads into that attachment.
- `ChatWidget` owns attachment display, removal, and redacted message persistence.
- `streamChatEvents` sends selected blocks as `type: "selected-block"` parts.
- Backend chat extraction separates user text from contextual parts.

## Alternatives

- Keep prompt-only flow: rejected because it cannot support attachment UI, redaction, or clean query extraction.
- Store real uploaded markdown files: rejected for this local selected-block use case because it introduces upload/storage failure modes before proving the UX.
- Put the serializer inside `ai-memo.js`: rejected because it keeps business rules in an untyped public script.

## Consequences

Pros:

- The composer can render `selected-block.md` independently from the input text.
- Raw selected content can be excluded from local session persistence.
- Backend can use only the user question for RAG query derivation while still supplying the selected block as model context.

Cons and risks:

- Frontend and backend chat part contracts both change, so tests must cover backward compatibility.
- Existing prompt fallback remains temporarily, which means there are two paths until the flagless migration is complete.
- Large selected blocks are still sent in request payloads, capped client-side for now.

## Coexistence And Rollback

The event name `aiMemo:askSelectedBlock` remains unchanged. If the attachment path fails, callers can still pass `message` and the receiver can fall back to opening the chat with legacy prompt text.

Rollback points:

- Revert the React attachment state changes and keep `useSelectedBlockActions` calling `openChat(message)`.
- Backend structured part support is additive; old `{ type: "text" }` requests continue to work.
- No database or durable storage migration is introduced.

## Implementation Handoff

Implemented in this refactor:

- Selected-block attachment contract and serializer.
- Chat widget composer attachment rendering and removal.
- Chat transport `selected-block` parts.
- Backend text/context extraction compatibility.
- Focused unit tests for serializer and backend extraction.

Future coder tasks:

- Add Playwright coverage for the full screenshot flow.
- Replace the public-script action menu with a React/Radix menu.
- Add a runtime feature flag if this path needs staged production rollout.
