# Worktree delivery verification — 2026-09-11

PR: https://github.com/choisimo/blog/pull/182
Base: `21242839` (main after PRs #180 and #181).

## Scope and preservation

All three registered worktrees were inspected. The primary worktree contained 517 changed/untracked file entries; the reading UI worktree contained 17, and the content-removal worktree was clean. Every initial file version was compared by SHA-256 with committed Git blobs: **534 checked, zero missing**. Deletions were checked for absence. `initial-files.json` records paths, statuses, hashes, and the preservation commits. The integrated branch merges both the published main history and the auxiliary artifact branch. Use a merge commit to preserve these intermediate versions.

Generated JSON/RSS/sitemap conflicts were resolved to the integrated catalog and then regenerated using the current Markdown sources. The deleted report remains absent. The final build generated 139 public post pages and three static pages. Earlier catalog timestamps/versions remain in the merge ancestry.

## Verification

| Check | Result |
| --- | --- |
| `npm --prefix frontend run build` | Passed, including prebuild generators and static HTML |
| Frontend, API gateway, SEO type-checks | Passed |
| `npm --prefix frontend run lint` | Passed: zero errors, 74 warnings (same warning count as main) |
| Changed frontend test files | 11 files, 100 tests passed |
| Post-fix dialogs/translation/blog characterization | 3 files, 23 tests passed |
| Backend suite | 112 passed, 1 skipped |
| API gateway suite | 36 files, 129 tests passed |
| Shared contract suite | 9 tests passed |
| SEO gateway | 112 unit + 11 real HTMLRewriter runtime tests passed |
| Anonymous regression script | 84 passed |
| Translation regression script | 97 passed |
| Reader image SQLite contract script | 26 passed; TYPESCRIPT_PATH points to frontend/node_modules/typescript |
| Contracts/routes/orphan routes/memory embedding outbox | Passed |
| Orphan checker filesystem fixtures | Reachable child/cycle accepted; disconnected pair/cycle rejected |
| Korean scan | Existing zero-width character in public/posts/2024/queue.md emoji; no NFC issues |

Validation fixes: follow route imports reachable from registered roots; avoid hard-coded historical public post counts while still checking every current public post; document storage fallbacks; retain dialog generation refs during cleanup; document the intentional topic-based image-scope memo dependency. No feature flags were enabled.

## Full frontend suite limitation

The integrated full run has **334 passing / 63 failing files, 1,470 passing / 96 failing tests, and one unhandled error**. It is not a passing full suite.

A fresh `git archive origin/main frontend shared` baseline was run against the same installed third-party dependencies, with archived shared source mounted over the shared dependency in a read-only, network-isolated bubblewrap namespace. Only the temporary baseline directory was writable. It produced **330 passing / 65 failing files, 1,461 passing / 98 failing tests, and one unhandled error**. The initial harness attempt failed before collecting tests due to a non-writable temporary directory; the completed run used a writable TMPDIR and is the only baseline counted here.

Of the 96 integrated failed assertions, 92 have matching baseline failure names. Four integrated-only failures are in FloatingActionBar.feature-flag.test.tsx; all eight tests in that file pass in the focused changed-file run. Baseline also has a different FAB failure. These remain order/timing-sensitive candidates, not confirmed resolved defects. Three suite-loading failures and the Radix scrollIntoView unhandled error occur in both runs. `frontend-baseline-comparison.json` includes the exact failure-name sets; matching names alone do not prove matching causes.

## Operational follow-ups

Migrations 0039–0041, private reader-image R2 provisioning, live provider execution, and staging/canary deployment remain outside this Git delivery verification. Reader images and translation execution/warming stay disabled in configuration. Existing implementation plans retain their incomplete checkboxes; this delivery does not mark future planned features or live environment verification complete.

GitHub check outcomes are authoritative on PR #182 and must be checked for its final head before merge.
