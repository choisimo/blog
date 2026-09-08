# Reader follow-up checks

2026-09-08. Current production preview at port 4319, system Chromium. The full objective remains open; see `frontend/docs/design/fieldnotes-reader-review.md`.

- Full build including generated manifests, SEO and static HTML: passed (`build.log`).
- TypeScript: passed (`typecheck.log`).
- ESLint: 0 errors, 74 existing warnings (`lint.log`).
- Original declaration/source contracts plus explicit amendments: 149 passed (`contracts.log`). TOC observer replacement is documented in `docs/ui-refactor/remaining-page-contracts.json`; original baseline hashes remain intact.
- Image viewer, code block and TOC unit tests: 22 passed; TOC's three tests rerun after the scroll-tracking fix (`image-code-unit.log`, `toc-unit.log`).
- Three browser suites: 51 passed (`browser.log`). These include real-article settings, sticky rails, large TOC jumps, mobile drawer focus, memo geometry/theme/draft preservation/fullscreen, and the existing site/reading regressions.
- Final visual runner: 32 captures of real content across light/dark and 390/1440 (`visual.log`, `../final/results.json`). Actual desktop block selection invokes the existing Turndown converter and appends the selected paragraph to the existing local draft.

The final visual build additionally removes the image control plate's residual shadow and moves the focus-exit button below the desktop quick actions. Those two CSS changes were visually checked after the 51-test run. The suite does not establish backend health or complete reference coverage; API requests were aborted without substitute successful responses. The visual block-capture flow permits its existing public CDN library. No remote publication occurred.
