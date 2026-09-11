# Frontend baseline comparison

The completed integration full suite reports **65 failed files / 97 failed tests**. Comparing the saved pre-integration archive with focused local runs identifies **93 preexisting assertion failures, 2 confirmed new test failures relative to the archive, and 2 full-suite-only failures that did not reproduce in the current focused run**. All **3 file-loading failures** also reproduce on baseline.

## Method and limits

- Baseline: `/home/nodove/workspace/blog-integration-backups/20260910-224016/before.tar.gz`, extracted to `/home/nodove/workspace/blog-integration-backups/20260910-224016/baseline`. Archive SHA-256: `1603c7e096c7f8ef4dbc35993b6d14e772374edadc2836cda5d001fc95839732`. This preserves prior user changes; no Git HEAD baseline was used.
- Waited until the supplied full-suite log had its final summary and no running Vitest process was observed. Ran only its 65 failed files on baseline, with four workers. Then ran only the 3 files containing baseline-passing/current-failing tests against current code.
- All 65 selected test files are byte-identical between archive and current checkout. Test setup, original Vite config, and frontend package lock are also identical. The frontend and shared package manifests differ.
- `baseline/frontend/node_modules` links to current frontend dependencies. `baseline/shared/node_modules` also links to current frontend dependencies. Because installed `@blog/shared` resolves to current `shared`, the baseline process privately mounted archived `baseline/shared` over that resolved path, read-only. Thus shared source and exports came from the archive; installed third-party dependencies were reused.
- Bubblewrap made the current repo and installed dependencies read-only and disabled network access with `--unshare-net`. Only the backup directory was writable. Config wrappers changed only cache location; temporary files, reports, and logs stayed in the backup directory. No repo edits, installs, external calls, or Git operations.
- Initial harness attempt could not write its temporary directory and ran zero tests; retained as `baseline-harness-attempt1-*` and excluded from findings. The successful baseline run uses writable `TMPDIR` inside the backup directory.
- This is a bounded failure comparison, not a full baseline suite or live-service validation. Contract mocks are tests. Snapshot differences identify newly failing expectations; they do not establish that the smaller integration-resolution edits described by the user caused a product defect.

## Results

| Run | Files | Tests | Duration |
| --- | --- | --- | --- |
| Supplied current full suite | 65 failed, 328 passed | 97 failed, 1459 passed | 70.72 s |
| Baseline: all 65 failed files | 63 failed, 2 passed | 93 failed, 202 passed | 21.67 s |
| Current: 3 candidate files | 3 failed | 3 failed, 25 passed | See current-candidates.log |

All **93** reproduced assertion failures have the **same test name and first error line** in the supplied full-suite log and baseline log. There are no additional baseline-only assertion failures in the focused selection.

## Confirmed new failures relative to archive

1. `src/test/chatUploadAuth.test.ts:390` — **normalizes aggregate prompts before sending them**. Baseline passes; supplied current full suite and current focused rerun fail. The test expects an exact body containing only the normalized `prompt`; `src/services/chat/api.ts:623` now includes `agentPreferences`. The normalized prompt itself still matches. This is a test request-body expectation mismatch, not evidence from a live backend.
2. `src/test/aiMemoWindowSystem.static.test.ts:42` — **authenticates static AI summarize and Catalyst requests**. Baseline passes; supplied current full suite and current focused rerun fail. The source-string test requires `/api/v1/auth/anonymous` in `public/ai-memo/ai-memo.js`. Current code delegates via `anonymousSessionRuntime()` at line 978 and `getValidAnonymousToken()` at line 995; `getAiJsonHeaders()` still assigns the bearer header at line 1013. This confirms a stale inline-code expectation after delegation, not a demonstrated authentication failure.

## Full-suite-only failures, not confirmed regressions

`src/test/FloatingActionBar.feature-flag.test.tsx`:

- **renders memo stack and insight actions on the home route when enabled** (`:108`): failed in supplied full suite; passed in baseline focused and current focused runs.
- **falls back to visited-posts minimap when ai-memo is absent** (`:172`): failed in supplied full suite; passed in baseline focused and current focused runs.

Treat both as unresolved timing/order-sensitive candidates. One focused rerun does not prove their cause. The same file's **renders FAB toolbar when enabled** (`:92`) fails in all three runs and is preexisting.

## Preexisting loading and unhandled errors

- `scripts/ui-foundation-contracts.test.mjs`: “No test suite found in file” in both snapshots.
- `scripts/ui-remaining-pages.test.mjs`: “No test suite found in file” in both snapshots.
- `scripts/reading-verification/core.test.mjs`: “The URL must be of scheme file”, originating in `scripts/reading-verification/loader.mjs:11`, in both snapshots.
- Radix Select unhandled rejection: `TypeError: candidate?.scrollIntoView is not a function` in both snapshots; baseline associates it with `AuditLogViewer.test.tsx` execution. This is an additional runner-reported error, separate from the 97/93 assertion counts.

## Every selected file

Counts below are failed assertions; loading failures have no collected Vitest assertions.

| File relative to frontend | Current full failures | Baseline focused failures | Classification |
| --- | --- | --- | --- |
| `scripts/reading-verification/core.test.mjs` | load failure | load failure | Preexisting file-loading failure |
| `scripts/ui-foundation-contracts.test.mjs` | load failure | load failure | Preexisting file-loading failure |
| `scripts/ui-remaining-pages.test.mjs` | load failure | load failure | Preexisting file-loading failure |
| `src/components/atoms/LoadingButton.test.tsx` | 1 | 1 | Preexisting |
| `src/components/atoms/TouchIconButton.test.tsx` | 1 | 1 | Preexisting |
| `src/components/common/SkipLink.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/admin/AiImageGeneratorPanel.test.tsx` | 2 | 2 | Preexisting |
| `src/components/features/admin/ai/ModelsManager.test.tsx` | 2 | 2 | Preexisting |
| `src/components/features/admin/ai/ProvidersManager.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/admin/ai/RoutesManager.test.tsx` | 2 | 2 | Preexisting |
| `src/components/features/admin/logs/LogViewer.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/admin/rag/RAGManager.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/admin/secrets/AuditLogViewer.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/admin/secrets/SecretsListManager.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/blog/SafeDescriptionMarkdown.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/blog/commentFeed.test.ts` | 2 | 2 | Preexisting |
| `src/components/features/chat/widget/components/ChatSidebar.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/console/ConsoleTrace.test.tsx` | 1 | 1 | Preexisting |
| `src/components/features/console/useConsoleState.test.ts` | 1 | 1 | Preexisting |
| `src/components/features/insight-workspace/domain.test.ts` | 1 | 1 | Preexisting |
| `src/components/features/navigation/PostNavigation.test.tsx` | 1 | 1 | Preexisting |
| `src/components/ui/carousel.test.tsx` | 1 | 1 | Preexisting |
| `src/components/ui/chart.test.tsx` | 1 | 1 | Preexisting |
| `src/components/ui/input-otp.test.tsx` | 1 | 1 | Preexisting |
| `src/lib/touch-target/__tests__/touch-target.audit.test.ts` | 4 | 4 | Preexisting |
| `src/pages/admin/AdminAuthCallback.test.tsx` | 3 | 3 | Preexisting |
| `src/test/AdminAuth.security.test.tsx` | 10 | 10 | Preexisting |
| `src/test/AdminDashboard.nav.test.tsx` | 1 | 1 | Preexisting |
| `src/test/AiImageGeneratorPanel.test.tsx` | 1 | 1 | Preexisting |
| `src/test/BlogCard.prefetch.test.tsx` | 1 | 1 | Preexisting |
| `src/test/BotChatPanel.test.tsx` | 1 | 1 | Preexisting |
| `src/test/ChatDialogs.test.tsx` | 2 | 2 | Preexisting |
| `src/test/ChatInput.test.tsx` | 1 | 1 | Preexisting |
| `src/test/ChatMessages.test.tsx` | 2 | 2 | Preexisting |
| `src/test/ChatSidebar.test.tsx` | 1 | 1 | Preexisting |
| `src/test/ConsoleMessages.test.tsx` | 1 | 1 | Preexisting |
| `src/test/ContentManager.test.tsx` | 1 | 1 | Preexisting |
| `src/test/FloatingActionBar.feature-flag.test.tsx` | 3 | 1 | 1 preexisting; 2 full-suite-only failures (focused current passed) |
| `src/test/HeaderSearchBar.test.tsx` | 1 | 1 | Preexisting |
| `src/test/LiveRoomPanel.test.tsx` | 1 | 1 | Preexisting |
| `src/test/MarkdownRenderer.images.test.tsx` | 1 | 1 | Preexisting |
| `src/test/PostCard.test.tsx` | 2 | 2 | Preexisting |
| `src/test/PostEditorWorkspace.test.tsx` | 7 | 7 | Preexisting |
| `src/test/PostNavigation.test.tsx` | 1 | 1 | Preexisting |
| `src/test/SeriesNavigation.test.tsx` | 3 | 3 | Preexisting |
| `src/test/SystemStatusMessage.test.tsx` | 2 | 2 | Preexisting |
| `src/test/TableOfContents.test.tsx` | 1 | 1 | Preexisting |
| `src/test/adminConfigAuth.test.tsx` | 1 | 1 | Preexisting |
| `src/test/adminSecretsHooks.test.tsx` | 1 | 1 | Preexisting |
| `src/test/adminSessionService.test.ts` | 2 | 2 | Preexisting |
| `src/test/aiMemoWindowSystem.static.test.ts` | 1 | 0 | Confirmed new test expectation mismatch |
| `src/test/chat.stream.test.ts` | 1 | 1 | Preexisting |
| `src/test/chatContext.test.ts` | 1 | 1 | Preexisting |
| `src/test/chatSessionPanel.test.tsx` | 2 | 2 | Preexisting |
| `src/test/chatUploadAuth.test.ts` | 1 | 0 | Confirmed new test expectation mismatch |
| `src/test/commonUtils.test.ts` | 1 | 1 | Preexisting |
| `src/test/curiosityService.test.ts` | 2 | 2 | Preexisting |
| `src/test/footerLinks.test.ts` | 1 | 1 | Preexisting |
| `src/test/reactionsService.test.ts` | 1 | 1 | Preexisting |
| `src/test/sitemap.test.ts` | 1 | 1 | Preexisting |
| `src/test/synonyms.test.ts` | 1 | 1 | Preexisting |
| `src/test/useChatSession.test.tsx` | 1 | 1 | Preexisting |
| `src/test/useSelectedBlockActions.test.tsx` | 1 | 1 | Preexisting |
| `src/test/useVisitedPosts.test.tsx` | 1 | 1 | Preexisting |
| `src/test/webSearch.test.ts` | 1 | 1 | Preexisting |

## Evidence artifacts

- Original completed full-suite log: `/tmp/blog-integration-frontend-all.log`, summary line 28080.
- Baseline log: `baseline-focused.log`, summary line 21225.
- Baseline structured results: `baseline-focused.json` (use `testResults` for 65 file results; Vitest JSON aggregate suite counters include nested describe blocks).
- Current candidate log: `current-candidates.log`, summary line 6441.
- Current structured results: `current-candidates.json`.
- Per-test matching and classifications: `comparison.json`.
- First-error signature comparison: `failure-signatures.json` (93 identical).
- Exact file selection: `failed-files.json`.
- Recorded commands: `baseline-command.json`, `current-candidates-command.json`; both runs used `TMPDIR=/home/nodove/workspace/blog-integration-backups/20260910-224016/test-tmp`, `NO_COLOR=1`, `FORCE_COLOR=0`.

User-reported independent validation (not rerun or independently verified here): source integration 11 suites / 76 tests passed; workers 129 passed; backend 112 passed + 1 skipped; SEO 123 passed.
