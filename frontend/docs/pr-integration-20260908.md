# Frontend PR integration verification — 2026-09-08

Base: `5eae2027004496baaef747fbceb34af5fffe856b` (`main`, after PR #171).
This integrates the remaining local frontend changes. Earlier reading UX, catalog, Sentio, and reading-progress merges remain intact.

## Fresh verification

- `npm run type-check`: passed.
- `npm run lint`: passed, 0 errors and 74 existing warnings.
- Changed Vitest files (`npm run test:run -- --maxWorkers=4 <29 changed files>`): 121 tests passed.
- `npm run test:deploy -- --maxWorkers=4`: 46 tests passed.
- `npm run test:reading -- --maxWorkers=4`: 31 tests passed; overlaps with the changed-file suite.
- `npm run verify:reading`: source checks and 38 tests passed.
- `node --test scripts/ui-foundation-contracts.test.mjs`: 54 tests passed.
- `npm run build`: complete prebuild/build/postbuild passed, including generated manifests, SEO, optimized images, runtime configuration, and static HTML.
- Playwright against the production preview at `http://127.0.0.1:4186`, Chromium `/usr/bin/chromium`, one worker: 18 reading cases, 22 site design cases, and 23 article diagram cases passed.
- `npm run korean:scan`: no NFC issues; the unchanged `2024/queue.md` title contains one emoji ZWJ reported by the scanner.
- `git diff --cached --check`: passed.

The initial five-worker browser run encountered Chromium resource errors and was interrupted. Single-worker verification completed. The project search test now supplies one local fixture project because the published catalog was intentionally emptied by PR #169. The article tests derive their allowed origin from Playwright's configured base URL so CI preview ports work too.

## Scope and limits

The change improves responsive public/admin layouts, search failure and retry states, dialog focus and keyboard ownership, memo interactions, and data-validated article diagrams. It includes 27 diagrams across 14 posts; only the two editorial reviews recorded in the content report are complete. This is not a claim that every post or every legacy test has been reviewed.

The older reports in the evidence directories describe their original snapshots and can contain superseded failures. The fresh verification above is authoritative for this integration. Existing administrator test debt is recorded in `design-review-20260908/admin-coverage/unit-baseline-comparison.json`; the full legacy suite was not rerun locally. Live provider calls and terminal command execution were not exercised. Existing lint, bundle-size, and dependency warnings remain.
