# PRD: Floating Action Bar (FAB) & History Button UI/UX Improvement

- Version: v1.0 (Final)
- Date: 2025-10-20
- Owner: Blog UX/FE
- Status: Approved & Implementing

## 1) Background / Problem
- Contextless memo buttons are visible even when the memo panel is closed.
- History entry point is inconsistent across pages.
- Multiple floating buttons create visual noise and distract from content.

## 2) Goals
- Tie actions to context (memo actions visible only when memo is open).
- Persistent, consistent History access site‑wide.
- Simplify bottom UI into a single bar.

KPIs: History entry CTR +20%, 0 misclick reports on memo actions, no performance regression (CLS +0, transition 60fps).

## 3) In / Out of Scope
- In: New FAB, persistent History button, contextual visibility, animations, a11y, responsive, instrumentation.
- Out: Memo core logic and History overlay features (graph, search) — unchanged.

## 4) User Scenarios
- Any page: History in the same bottom‑right location.
- When memo opens: contextual memo actions fade‑in on FAB; close → fade‑out.

## 5) Requirements

### 5.1 Unified FAB
- Position: fixed bottom, centered; safe‑area padding; z-index above footer, below modals.
- Style: semi‑transparent background + backdrop blur, rounded, subtle shadow.
- Areas: left/center (memo actions), right (History).
- Always mounted; respects reduced motion.

### 5.2 History Button
- Persistent at FAB right end.
- Responsive label: desktop (md+) icon + “History”; mobile icon‑only with `aria-label`.
- Badge (dot): shown when there are new events since last open; cleared upon opening overlay.
- Opens AI‑memo “Web of Curiosity” overlay.

### 5.3 Contextual Memo Buttons
- Targets: Add selection, Add to graph, AI summary, Catalyst, Download.
- Visibility: hidden by default; shown only when memo panel is open (fade). Disabled with tooltip when no data.
- Keyboard accessible; logical tab order.

## 6) Interaction & Animation
- Use opacity/transform transitions (150–200ms). Respect `prefers-reduced-motion`.
- No focus stealing; restore focus on overlay close.

## 7) Accessibility
- FAB: `role="toolbar"`, labeled groups via `role="group"`.
- AA contrast, keyboard/reader-friendly. `aria-expanded` where applicable.

## 8) Technical
- Feature flag: `VITE_FEATURE_FAB` + runtime override `localStorage['aiMemo.fab.enabled']`.
- Memo state source: AI Memo panel open state from web component (shadowRoot `.panel.open`) + `localStorage['aiMemo.isOpen']`.
- Global mount: in layout (`frontend/src/App.tsx`).
- Styling: Tailwind; `backdrop-filter` support with graceful fallback; iOS safe‑area handled.
- Performance: CSS animations only; minimal JS observers.

## 9) Instrumentation
- Events: `fab_impression`, `fab_history_click`, `fab_memo_*` (add_selection, add_graph, ai_summary, catalyst, download), `fab_error`.

## 10) Responsive / Devices
- Mobile: horizontal scroll if actions overflow; 40px min hit target.
- Desktop: icon+text when space allows; tooltips.
- Print: hidden.

## 11) Edge Cases
- Footer overlap: FAB layered above.
- Third‑party widgets: z‑index tokens to avoid conflicts.
- Safari backdrop support: non‑blur fallback.
- Modal policy: when any site modal opens, FAB hides.

## 12) Rollout
- Phase 0: Off by default; QA via localStorage override.
- Phase 1: Dev on.
- Phase 2: Prod 10% on via env.
- Phase 3: 100% on and remove legacy AI Memo launchers and scattered buttons.
- Rollback: set `VITE_FEATURE_FAB=false` or override localStorage false.

## 13) Risks & Dependencies
- Memo state mismatch ↔ observer+storage handled.
- z-index conflicts ↔ tokens & QA matrix.
- Shadow DOM access stability ↔ fallback via launcher click.

## 14) Decisions (Resolved)
- History label: responsive — desktop icon+text, mobile icon‑only with aria‑label.
- History badge: dot indicator since last open; cleared on overlay open.
- FAB during modal: hidden (do not blur) to avoid focus trap and distraction.
- Legacy buttons removal: at Phase 3 start (immediately upon 100% rollout).

## 15) Acceptance Criteria
- [ ] On load, only History shows in FAB.
- [ ] History visible/working regardless of memo panel state.
- [ ] Opening memo shows memo actions with fade‑in; closing hides with fade‑out.
- [ ] FAB remains fixed on scroll; safe‑area respected; print hidden.
- [ ] Desktop shows icon+text for History; mobile icon‑only with `aria-label`.
- [ ] Badge shows when there are new history events since last open; opening overlay clears it.
- [ ] Any site modal open → FAB hidden; closed → FAB restored.
- [ ] `prefers-reduced-motion`: no animations.
- [ ] CLS 0, perf regression none; transitions 60fps.
- [ ] Instrumentation events fire as specified.

## 16) QA Verification Checklist (PASS/FAIL with evidence)
- **[Layout/Position]** All breakpoints fixed positioning & safe‑area → PASS/FAIL (+screenshots)
- **[Contextual Visibility]** Memo open/close transitions & disabled states → PASS/FAIL (+video/log)
- **[History Badge]** New events increment and clear on open → PASS/FAIL (+steps)
- **[Accessibility]** Keyboard nav, roles/labels, screen reader behavior → PASS/FAIL (+reader log)
- **[Performance]** 60fps transitions, no memory growth → PASS/FAIL (+perf capture)
- **[Browser Matrix]** Chrome/Firefox/Safari/iOS/Android → PASS/FAIL (+notes)
- **[Modal Policy]** With dialog/sheet/alert-dialog open, FAB hidden → PASS/FAIL (+screens)
- **[Instrumentation]** Events visible in analytics or console → PASS/FAIL (+capture)

---

## Implementation Notes
- Component: `frontend/src/components/features/memo/FloatingActionBar.tsx`.
- Integration: `frontend/src/App.tsx` renders FAB globally; hides `VisitedPostsMinimap` when the FAB is enabled to avoid duplicate History triggers.
- AI Memo launchers are hidden when FAB is enabled (Phase 3 will remove legacy codepaths).
