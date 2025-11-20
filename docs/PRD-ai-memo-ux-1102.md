# PRD: Floating AI Memo UX Revamp (1102)

- **Author**: Cascade (AI assistant)
- **Date**: 2025-11-02
- **Status**: Draft / For Review
- **Related initiative**: 떠다니는 AI 메모 개선

---

## 1. Background & Problem Statement

The floating AI Memo widget ships as a Shadow DOM injection that currently splits the "편집기" (editor) and "미리보기" (preview) panes vertically (stacked top ↔ bottom). Screenshots and field feedback show that the narrow vertical layout greatly limits horizontal reading space for longer Markdown content or code. Users struggle to scan preview output and maintain context while editing. The CSS toggles a `preview-mode` host class to switch to side-by-side layout, but the experience is inconsistent and not user-driven.

## 2. Goals

1. Provide a more readable layout for editing and previewing Markdown notes (e.g., side-by-side horizontal split or tabbed view).
2. Allow users to switch between preferred layouts (split, tabs) when possible.
3. Improve Catalyst prompt entry and inline AI interactions without blocking memo usage.
4. Preserve mobile usability and responsive behavior.

## 3. Non-Goals

- Rewriting the entire AI Memo feature or backend flows.
- Replacing the Shadow DOM delivery approach.
- Changing persistence model (localStorage keys) beyond what's needed for new UX state.

## 4. Current State Summary

- Layout behavior controlled via CSS classes inside `/frontend/public/ai-memo/ai-memo.css` and toggled by host classes (e.g., `.preview-mode`).
- JavaScript controller (`/frontend/public/ai-memo/ai-memo.js`) handles tab switching and memo state.
- Catalyst UI opens inline within footer area with limited feedback.
- Mobile breakpoint collapses to column layout but lacks layout switching logic.

## 5. User Stories & Acceptance Criteria

### Story B1 – Horizontal split option

- Role: memo power user editing long notes
- Goal: view editor and preview side by side with generous width
- Benefit: reduces scrolling and improves comprehension of formatted output

#### Acceptance criteria – horizontal split

1. Toggling to horizontal split gives each pane ~50% width with responsive flex (minimum width safeguards).
2. Resizing window retains side-by-side layout until mobile breakpoint (< 640px) where it gracefully stacks.
3. Divider spacing and scroll independence preserved (each pane scrolls independently).

### Story B2 – Tabbed editor/preview

- Role: writer on smaller laptop
- Goal: switch between full-width editor and full-width preview using tabs
- Benefit: maximizes space per mode while keeping navigation lightweight

#### Acceptance criteria – tabbed view

1. Tabs labeled "편집" and "미리보기" show only the active pane; other is hidden.
2. Active tab persists for the session via localStorage key (optional but recommended).
3. Keyboard/mouse focus remains in editor when returning from preview.

### Story B3 – Layout toggle control

- Role: memo user with diverse workflows
- Goal: quickly choose between split vs tab view
- Benefit: gives agency without diving into settings modal

#### Acceptance criteria – layout toggle

1. Add layout toggle button(s) near tabs or toolbar (e.g., icon group for split/tabs).
2. State persists between sessions (localStorage, separate key).
3. Clear affordance indicates current mode (active state or tooltip).

### Story B4 – Catalyst UX polish

- Role: user invoking Catalyst prompt
- Goal: avoid disruptive modal overlay and get subtle status cues
- Benefit: maintains editing flow while AI result inserts calmly

#### Acceptance criteria

1. Replace full popup spinner with inline indicator (e.g., pulsing spark icon near Catalyst button) during generation.
2. When Catalyst runs, disable input with busy affordance but keep panel accessible.
3. On success insert text with highlight animation (optional) and toasts for feedback; on error show non-blocking toast.
4. Error toasts replace `alert` usage; use existing toast div or add a more modern pattern.

## 6. Functional Requirements

1. Introduce layout state machine with modes: `split-horizontal`, `split-vertical` (optional legacy), and `tabbed`.
   - Default: horizontal split for desktop, tabbed for < 1024px if desired.
   - Provide toggle control UI and persist via `aiMemo.layout` key.
2. Update CSS (`ai-memo.css`) to support horizontal split by default, with responsive fallbacks.
3. Adjust JS (`ai-memo.js`) to:
   - Initialize layout from storage / viewport.
   - Handle toggle interactions and class switching.
   - Manage tab visibility without relying solely on `preview-mode` host class.
4. Revise Catalyst interactions in `runCatalyst` and toolbar handlers.
   - Replace spinner overlay with inline icon state.
   - Route feedback through toast helper.
   - Optionally integrate with shadcn-style toast if available in Shadow DOM (otherwise keep custom toast).
5. Add accessibility considerations: aria labels for toggles, focus management after layout switches.

## 7. UX & Visual Guidelines

- Horizontal split: 16px gap, balanced pane widths, subtle divider line (optional).
- Tabs: use existing `.tab` styles; highlight active with bottom border.
- Toggle buttons: small icon buttons consistent with memo toolbar (e.g., 32px square, tooltip on hover).
- Catalyst indicator: animate Spark icon or show inline dot; avoid modal overlays.
- Toast copy examples: "Catalyst 결과가 메모에 추가되었습니다", "Catalyst 생성 중 오류가 발생했습니다.".

## 8. Technical Notes

- Shadow DOM limits direct usage of Tailwind; rely on existing CSS or inline styles.
- Ensure layout toggles respect `:host(.memo-full)` fullscreen mode.
- Use MutationObserver or ResizeObserver sparingly; prefer CSS `@media` for responsiveness.
- For Catalyst indicator, reuse existing `out.setStatus` or extend to include icon state.
- When adjusting runCatalyst endpoint once unified (see Catalyst refactor PRD) ensure loading UI still works.

## 9. Analytics / Telemetry

- Log layout mode changes via `logEvent({ type: 'layout_change', mode })` to reuse local storage telemetry.
- Track Catalyst success/error counts for UX evaluation.

## 10. Dependencies / Risks

- Storage schema changes should handle existing users (fallback to default when missing).
- Toggle control must not conflict with existing toolbar buttons (space constraints).
- Catalyst refactor overlaps with API routing plan—coordinate merges to avoid conflicts.

## 11. QA Checklist

- ✅ Desktop horizontal split with long markdown sample
- ✅ Tabbed mode persistence across reload
- ✅ Mobile viewport < 640px: layout stacks gracefully, toggle hidden or adapted
- ✅ Catalyst busy state and toast messaging (success + failure)
- ✅ Regression: memo drag/move, fullscreen mode, history overlay unaffected

## 12. Rollout Plan

- Ship behind runtime flag? If necessary, add query param or localStorage flag for staged rollout.
- Announce in release notes once validated.

## 13. Open Questions

1. Should vertical split remain an option or removed entirely?
2. Do we need resizable divider for horizontal split? (Stretch goal.)
3. Should Catalyst results insert at cursor or append? (Currently appends; consider user preference.)

---

## Appendix B – Reference Artifacts

- Stylesheet: `frontend/public/ai-memo/ai-memo.css`
- Controller script: `frontend/public/ai-memo/ai-memo.js`
- Catalyst telemetry keys: `aiMemo.events`
