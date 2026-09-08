# Reading tools follow-up evidence

Production preview: `http://127.0.0.1:4319`, built from the current worktree. Actual bundled posts: `c-lang-2`, `teleport`, and `organizing-intelligence-era`. Browser: system Chromium with repository Playwright. API and external requests are aborted; no invented response bodies or credentials are used.

Run from `frontend/`:

```sh
npm run build
node scripts/design-verification/fieldnotes-reading-tools-browser.mjs
DESIGN_BASE_URL=http://127.0.0.1:4319 DESIGN_CHROMIUM_PATH=/usr/bin/chromium npx playwright test --config config/playwright.design.config.ts
```

`results.json` records six passed real-content scenarios: light/dark × 320/390/1440, with zero page errors. They cover bookmark storage/reload/remove, article-find keyboard navigation and cleanup, preserving reading position on closing, result index stability during code expansion, actual Markdown comment preview and block formatting, draft retention after a real aborted POST, discard/continue focus, and persisted minimum/maximum reading settings. The 500px-height captures verify viewport reflow and reachable submission controls, not a physical keyboard session.

All screen captures were generated from actual UI states. `find-long-code` captures a match inside expanded code. Comment errors are actual `Failed to fetch` errors after respecting the three-second anti-abuse gate. The generated cover is the user's latest linocut replacement.

`checks/` retains successful TypeScript, production build, 25 focused unit tests, 149 contracts, ESLint (0 errors / 74 existing warnings), 51 browser regressions, and the six added real-content scenarios. Older fixture-based tests in the existing suites are supplemental; real-content checks are identified separately.

The four article PDFs cover light/dark prose, tables, plain/highlighted code and unavailable-image links. `generated-cover-print.pdf` verifies the loaded project image in a two-page print excerpt. `print-checks.json` compares the longest code examples to extracted PDF text and checks that loading labels, skip links and comment controls are absent. Text checks are supplemented by inspected rendered pages (`dark-print-page2.png`, `dark-print-long-code.png`, `generated-cover-print-page1.png`). Earlier intermediate PDF extraction images may remain in this directory; the named PDFs and final page renders are the authoritative print evidence.

Review found that PDF text extraction could pass while code was visually obscured. Final print rules remove screen effects and clipping, normalize dark emphasis colors, and replace unavailable media with an original-image link. The PDF page renders were inspected after those changes.

No successful AI generation, backend comment publication, authentication or deployment is claimed. Successful AI-result presentation remains source-reviewed; the local AI availability flag is false. Remaining paragraph-analysis/quiz and rich-media print states are tracked in `docs/design/fieldnotes-reader-review.md`; this evidence does not claim the full design goal complete.
