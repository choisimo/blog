# ADR: AI Memo Window System Refactor

Date: 2026-04-29

## Context

`frontend/public/ai-memo/ai-memo.js` previously mixed memo editing, launcher integration, fullscreen toggling, drag positioning, mobile scroll locking, and route-driven rail mode in one implicit panel state. The old `restore()` path reset `aiMemo.position` on every load, so user placement could not be treated as durable layout state. The fullscreen action only toggled `memo-full`, without a typed transition model for restore, docked, resize, or snap states. React FAB integration in `frontend/src/components/features/memo/fab/index.tsx` also depended on clicking Shadow DOM element IDs.

## Decision

Introduce a strangler-style window state contract inside the existing web component:

- `aiMemo.window.mode`: `floating | fullscreen | docked`
- `aiMemo.window.bounds`: `{ x, y, width, height }`
- `aiMemo.window.previousBounds`: restore target for fullscreen/docked transitions
- `aiMemo.window.snap`: optional snap placement

The static web component remains the runtime owner of drag, resize, snap, fullscreen, docked, body-scroll locking, and persistence. React FAB now sends `aiMemo:windowCommand` instead of depending only on Shadow DOM button clicks.

## Alternatives

- Rewrite AI Memo as bundled React components: better testability, but too much blast radius for the current public asset and existing memo/version/selection behavior.
- Keep CSS-only fullscreen/rail patches: lower diff, but preserves hidden state bugs and makes resize/snap restore unreliable.

## Consequences

The new controller adds more code to the legacy static asset, but isolates layout transitions behind explicit methods and storage. Existing memo content, versioning, selected-block attachment work, and FAB feature flags remain in place.

## Migration And Rollback

Migration is additive:

1. Existing `aiMemo.position` is read as a legacy fallback.
2. New layout state is persisted under `aiMemo.window`.
3. If issues occur, disable the runtime FAB with `aiMemo.fab.enabled=false` or revert this ADR's asset changes. Existing memo content remains under `aiMemo.content`.

## Production Readiness Notes

- Cache busting was updated for both `/ai-memo/ai-memo.js` and `/ai-memo/ai-memo.css`.
- `node --check` covers syntax risk in the static asset.
- A Vitest static guard now asserts the window command bridge and CSS affordances remain present.
