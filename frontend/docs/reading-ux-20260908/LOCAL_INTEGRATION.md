# Reading UX archive integration — 2026-09-08

Applied `blog-reading-ux-refactor-20260908.tar.gz` (SHA-256 `6d1912cb9914dfce6418815bde084b7cbd8e861b89f7da9b14c2022967a4f8fc`) to `/home/nodove/workspace/blog` at `fec03b91989d`.

## Review scope

The archive changes 33 files relative to the current working tree (15 existing files and 18 additions). The remote `main` at `fc70ac72` predates the cumulative RICH UI source used by the archive, so this PR includes those source prerequisites. It is built from remote main in a separate worktree. The original eight generated manifest/SEO edits are preserved in the original checkout and excluded from this PR. Previous generated design images and backup journals are excluded. The three UI contract fixtures required by the cumulative source tests are included.

## Integration corrections

- Remove one redundant regex escape, three unused helper exports, and one unused memo dependency; preserve the existing 74-warning lint ceiling.
- Update old Markdown assertions for unwrapped unsafe links, complete code text, and consecutive single-column article children. Separate the raw HTML block from Markdown in the comment security fixture.
- Use an HTTP code fence in the browser fixture (text fences intentionally render as prose panels), pin Korean locale, account for the terminal title prefix, and wait for the dialog entry animation before measuring touch targets.
- Keep dependency/lockfile preservation checks while allowing the new verification scripts. Replace the obsolete legacy CSS byte-preservation requirement with the supplied real-browser layout regression checks.

## Executed validation

Environment: Node 26.7.0, installed project dependencies. Chromium 1228 was used with a local Playwright executable override; the standard browser download did not finish, so that override is not part of production or CI configuration.

| Check | Result |
| --- | --- |
| `npm run type-check` | PASS |
| `npm run lint` | PASS: 0 errors, 74 warnings (same total as remote main) |
| `npm run verify:reading` | PASS: 38 pure-module tests; 21 syntax checks; 3 strict module checks |
| `npm run test:reading -- --maxWorkers=4` | PASS: 30 tests across 5 files |
| `npm run test:deploy -- --maxWorkers=2` | PASS: 46 tests across 7 files |
| Cumulative RICH component/Markdown regression tests | PASS: 38 tests across 8 files |
| `node --test scripts/ui-foundation-contracts.test.mjs scripts/ui-remaining-pages.test.mjs` | PASS: 148 tests |
| `npm run build` | PASS, including prebuild and postbuild; 139 post and 3 static HTML pages generated |
| Reading Playwright suite | PASS: 16 tests, 3 themes × 4 widths plus wrapping, image recovery, viewer focus and TOC |
| `npm run korean:scan` | Exit 0; existing zero-width character in `public/posts/2024/queue.md:11`, no NFC issues |
| `git diff --check` | PASS |

The complete legacy Vitest suites in both this branch and remote main were stopped after memory pressure; neither is reported as passing. Bounded `--maxWorkers=1 --bail=1` runs fail in `PostEditorWorkspace.test.tsx` on both revisions, on different assertions (draft deletion/autosave here, PR path normalization on main). This is not proof that all failures are pre-existing. The repository already runs the legacy suite as a non-blocking CI report. Required deployment tests pass.

Logs for this integration are in `/tmp/blog-reading-ux-20260908/`. `REPORT.md` and the imported archive logs describe the supplier's earlier environment and are retained as provenance; this file records the local integration results. Firefox, Safari, physical devices and live AI/translation/comment API behavior are outside the verified scope.
