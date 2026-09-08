# Fieldnotes frontend refactor

Reference: `/home/nodove/다운로드/nodove-fieldnotes-reader-refined.html` (2026-09-08).

## Final delivery scope — 2026-09-08

The user ended further general design iteration, then requested a final TOC scrollbar, copy and citation patch followed by PR creation and merge. The earlier open-audit notes below are historical; they do not authorize further design expansion. The final accepted scope and verification are recorded in [fieldnotes-final-delivery.md](fieldnotes-final-delivery.md). This handoff does not claim that every possible backend or overlay state was rendered.

## Reopened reader review — 2026-09-08

The user's follow-up correctly identified unfinished design work. The earlier page captures and passing suites below did not establish complete reference fidelity. A detailed reader audit found broken sticky positioning during long scrolls, legacy code/quote/discussion surfaces, an oversized memo window, a dark custom-element palette reset, stale TOC tracking after large scroll jumps, and an unadapted image viewer. The follow-up also connects missing reading tools, adds comment formatting/preview, and repairs print colors, overlays, code clipping and lazy-image fallback. These are being corrected against real article interactions. See `fieldnotes-reader-review.md` for current evidence and remaining work. The overall goal remains open.

## Decision and boundaries

Use the final refined reader's ivory paper, green ink and serif display typography across every registered route. Keep the existing React Router routes, query/data adapters, authentication, authorization and mutation semantics. The reference's local demo data, connection settings and capability tables are not production features and are not imported.

The shared public shell owns masthead, navigation and footer. The reader owns a narrow text column and responsive marginal tools; home and archive retain distinct editorial compositions. Admin keeps its existing sections and subtab state in a denser control-room layout. Insight keeps its graph and persisted workspace state. Auth and error pages use the same materials and typography.

Mobile uses content-driven stacks, 44px controls, horizontally scrollable data surfaces and reduced-motion support. Reading columns collapse at 1200px and 850px, with title, metadata and body sharing an axis. Terminal remains an explicit alternate theme. Public and admin URLs are unchanged.

## Implementation ownership

- `fieldnotes-foundation.css`: source reference's reusable `fn-*` composition and tokens.
- `fieldnotes-theme.css`: exact final reader palette and one-way legacy/UI token adapters.
- `fieldnotes-shell.css`: real masthead, footer and shared portal surfaces.
- `fieldnotes-public.css`: public editorial page compositions.
- `fieldnotes-reader.css`: article hierarchy, rails and responsive reading.
- `fieldnotes-workspaces.css`: admin, auth, editor, Insight and error page adaptation.
- `fieldnotes-overlays.css`: chat, search, visited history and custom memo theme integration.

The styles load after existing functional styles in `main.tsx`. The earlier reverse light/dark token bridge is removed to avoid cyclic CSS variables. Terminal's bridge remains independent.

## Verification scope

Full route inventory: `fieldnotes-route-inventory.md`. Type checking, focused behavior tests and browser rendering at mobile/tablet/desktop in light/dark/terminal are required. Completion remains unproven until actual page screenshots and reader/settings interactions are checked. Protected admin states must be distinguished from the unauthenticated login screen; a login screenshot does not verify the managers.

UI/UX Pro Max local `ux-guidelines.csv` query "reading long text responsive accessibility" supports descriptive image alternatives, minimum 16px mobile body text and fluid text reflow. Reference visuals remain authoritative.

## Earlier integration — 2026-09-08

All seven Fieldnotes stylesheets are consumed by the real entrypoint. Shared foundations, public compositions, article structure, reading preferences, workspaces and overlays are integrated. The memo shadow stylesheet has a new asset version. The user's article and PDF remain present; the final requested image replacement is `cover-ink-editorial.png`, used in metadata and content with a generated thumbnail. Browser plugin discovery returned no sessions; local rendering used installed system Chromium with repository Playwright. This earlier integration record predates the subsequently requested PR and merge.

## Earlier verification record (not proof of completion)

| Requirement | Current implementation | Evidence |
|---|---|---|
| Apply the supplied design throughout the frontend | Exact final reference light/dark/warm palette; shared serif headings, paper surfaces, thin rules, masthead and footer; independent terminal palette | `main.tsx` imports all style layers; 36 production screenshots in `verification-screenshots/fieldnotes-20260908/final-public/` |
| Distinct public page compositions | Split editorial home, ruled archive, profile/contact columns, project controls, debate entry and real Insight graph | Nine public/auth/error route families at 390/1440 in both themes; all screenshots inspected and zero runtime errors or page overflow |
| Actual refined reader | Left TOC, aligned title/metadata/body, right article actions; two/one-column responsive collapse and mobile tools | Production article screenshots; reader E2E at 320/390/768/1024/1440, code/image/lightbox/TOC checks |
| Working reading and companion tools | Persisted size/leading/font/width/paper, focus mode, memo, chat, search and visited history | Settings persistence, reload/reflow, focus return, mobile tools and actual memo checks in the 46 passing browser tests; overlay screenshots and visited-sheet checks |
| All administrator pages | Nine sections, all fifteen subtab IDs, login/callback, standalone editor; horizontal desktop navigation and mobile select | 80 final real-component cases, 12 auxiliary cases and four editor draft-preservation interactions; see `admin-review.md` |
| Preserve routes and behavior | Same 31 route elements, aliases, auth wrappers, original service ownership and editor mutations | 149 source/pure-function contracts; 34 focused Vitest tests; independent public/reader/admin source review |
| Usable responsive and theme states | Mobile reflow, 44px controls, semantic status colors, keyboard focus and reduced motion | 46/46 production browser regressions; visual reports above |

Checks passed: `npm run type-check`, `npm run lint` (0 errors, 74 existing warnings), `npm run build`, 149 Node source/pure-function contracts, 34 focused Vitest tests and 46 Playwright regressions. Build emitted existing large-chunk/Browserslist warnings. `checks/` under the screenshot directory retains command output. Source declaration gates preserve their original baselines: 23 formatting-only changes were reverted; five explicit amendments document the new archive composition, description sanitization and reduced-motion scrolling. Home visual gates were updated to the user's supplied design, while service-driven sections and retry controls remain required.

Verification limits: production public pages used actual bundled content with API/external requests aborted, without substituted response bodies. Administrator screenshots render actual components with their real unauthenticated/unavailable states; successful remote authentication, loaded operational data and server mutations were not exercised. Worker/config loaded branches were reviewed in source for shared layout/tokens and unchanged handlers. Project content is currently empty in the actual generated manifest. The changes implement presentation across these routes; these results do not establish backend health, external data correctness or deployment status. Earlier unrelated admin callback/navigation and ChatSidebar test failures reproduced against HEAD and remain documented in the specialist review.
