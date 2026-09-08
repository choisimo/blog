# Refined reader follow-up

Reference: `/home/nodove/다운로드/nodove-fieldnotes-reader-refined.html`, final `Reader v2` rules and rendered article/tools. Scope remains the user's request to find and finish missing design implementation across the frontend, starting with reading. This document does not reduce that scope to passing existing tests.

## Findings corrected in the reopened review

| Observed gap | Current change | Evidence |
| --- | --- | --- |
| Header and marginal rails scrolled away despite `position: sticky` | Root horizontal overflow uses `clip`, avoiding a body scroll ancestor | Real long-article regression at 390/1024/1440, scroll positions 1800/7000 |
| Code toolbar and renderer retained navy backgrounds | Reference green code tokens reach both highlighted and plain code | Real C article screenshots; wrap/copy behavior checks |
| Quotes retained a gradient and second decorative stripe | Plain gold rule, serif text, reference spacing | Before/after quote captures |
| Paragraph actions appeared after every paragraph | Desktop actions move to the margin and reveal on hover/focus; touch access remains | Real paragraph screenshots and mounted action owners |
| Tables and discussion inherited oversized legacy presentation | Compact table typography/local scrolling; flat discussion heading, natural text alignment | Mobile and desktop code/table/discussion captures |
| Mobile TOC filled the entire right edge | Labelled bottom-sheet TOC with 85dvh height | Actual drawer geometry and Escape/focus checks |
| Large scroll jumps left the first TOC entry active | Frame-scheduled tracking resolves the last heading above the reading line; observes content reflow | Real last-section jump and mobile current-item visibility regression |
| Memo covered most of the article at 1040px | Reader buttons and existing desktop dock open the same 420px docked mode; <=850px uses a 94dvh bottom sheet | Light/dark × 390/768/1024/1440; local draft survives closing, reopening, fullscreen |
| Dark memo reverted to black/blue | Custom-element host inherits root tokens; legacy textarea/active-tab overrides use memo tokens | Exact computed paper colors on panel and focused editor; dark screenshots |
| Focus mode left global navigation visible; exit overlapped quick actions | Hide edition/navigation with rails; separate exit from fixed quick actions | Focus screenshot and keyboard regression |
| Image viewer used an independent navy palette and top control plate | Reference paper background, serif title, lower controls, plain surfaces | Real generated cover opened/closed in both themes and widths; zoom/rotate/reset/focus checks |
| Block action menu retained purple gradients | Reference paper/ink menu, restrained primary action and lighter backdrop | Scoped shadow CSS; actual block-capture visual runner |
| Header lacked the reference reading-tool composition | Bookmark, share, article find, summary and more-tools actions reuse existing services | Real bundled articles at 320/390/1440; persisted bookmark/reload/remove; unavailable summary is explicitly disabled |
| Unicode article IDs and route changes broke bookmark state | NFC/decoded IDs accept actual Korean and spaced year/slug paths; hook resynchronizes on route and storage events | Real localStorage/hook integration tests, without service substitutes |
| Searching could interrupt markup, return to the top on closing, or reset after code expansion | DOM ranges across inline markup; literal Unicode matching; keyboard previous/next; preserve scroll/focus and selected index through expansion | Real `c-lang-2` and `teleport` searches, including all 12 `fork()` matches; nested-list and literal-query unit tests |
| Comment authoring lacked format and preview controls | Existing modal gains Markdown formatting and actual CommentMarkdown preview; block formatting preserves surrounding paragraphs | Actual bold/quote preview, edit, discard/continue and failed network submission; draft/name retained |
| Print retained modal backdrops, dark colors, emphasis colors and clipped/blank code surfaces | Print-specific colors and overflow; remove screen compositing effects, dialogs, skip links and controls | Rendered light/dark PDFs; source comparison of the longest C snippets and final `waitpid` lines |
| Offscreen images had no source URL and printed large loading placeholders | Native lazy image sources; request eager loading before print; pending/error images print a compact original-image link | Image viewer tests and real article print checks; no fabricated image response |
| Paragraph analysis retained violet accents, oversized inherited prose and a fixed 3D card stack | Flat paper panels, compact headings and modes, one visible evidence face and retained keyboard focus | Six actual-content light/dark scenarios at 320/390/1440; existing fallback is explicitly identified |
| Completing all ten quiz answers could leave “다음 문제 생성 중” indefinitely | Idle pre-generation runs only while the quiz is idle, avoiding its shared fetch guard during the active quiz | Failure reproduced after ten answers; all six scenarios complete and restart after the fix |
| Authored diagrams retained gradients, large radii and oversized captions | Compact reference paper, thin rules, subdued selected nodes and print-safe layout | Three actual diagrams in teleport-config; selection, mobile/desktop and both printed themes |
| Iframes retained large interactive surfaces in printed articles | A titled source link on screen, with a compact title/address replacing the frame on paper | All three actual teleport embeds, two printed PDFs with extracted titles/URLs and rendered print pages |
| Embedded paging tools retained blue/white styling inside the dark reading desk | Three authored documents opt into shared paper/ink tokens, theme-aware chart colors, 44px inputs/buttons and reduced motion | Actual CDN styles load; reference input, frame count, simulation results and theme changes are exercised without substituted responses |

## Companion and rich-content follow-up

`scripts/design-verification/fieldnotes-companion-tools-browser.mjs` completed six cases, light/dark at 320/390/1440. It checks initial paragraph modes, sketch failure/retry, the existing Prism fallback, evidence/summary focus, next/previous perspectives, existing ThoughtFeed fallback, close/reopen, and the complete ten-question quiz with feedback and restart. The actual AI-disabled follow-up field is asserted disabled. No successful AI response was supplied or claimed. The quiz's idle pre-generation race was reproduced with the real fallback flow before the idle-state guard fixed it. Seventeen focused tests, TypeScript/build, 149 contracts, lint (0 errors/74 existing warnings) and 51 browser regressions passed. Evidence is saved in `companion-tools/`.

`scripts/design-verification/fieldnotes-rich-content-browser.mjs` reads the three actual diagram definitions from `teleport-config.md`, exercises selection and verifies every diagram title/node label in printed PDFs. It also opens the three actual iframe documents in `teleport.md`; only their existing Tailwind/font CDN dependencies are allowed alongside local resources. The earlier blocked-CDN capture produced an oversized SVG and is retained as diagnostic evidence, not treated as the fully loaded design.

The iframe wrapper keeps the existing source resolution, preview isolation and height-message owner. Screen links provide full-document access; print replaces interactive frames with their titles and source paths. The three authored paging documents share `fieldnotes-simulator.css/js`; same-origin parent theme observation does not navigate or replace the iframe. Their existing algorithms and inputs remain the owners of results. The adapter reports body height through the existing auto-height protocol, with the parent's existing 320–6000px clamp, and disconnects observers on pagehide. It observes body content rather than viewport minimum height to avoid a growth loop. Separately opened documents use the device color preference.

UI/UX Pro Max was checked for print guidance; a focused query returned unrelated results and the narrower retry returned none. No dataset recommendation was applied. The reference palette, existing reader controls and observed browser/PDF behavior determined this change.

Final rich-content verification passed four light/dark mobile/desktop cases, including theme-preserved input/results, body-driven iframe sizing, zero runtime errors and no page overflow. Both diagram PDFs contain all 19 authored titles/node labels; both embed PDFs contain all three titles and source paths. Three separately opened simulator documents also passed device-theme changes without errors. The production build, TypeScript, 15 renderer tests, 149 contracts and lint passed; 51 browser regressions passed before the final iframe-height adapter, which the four final real-content cases rechecked after rebuilding. See `rich-content/README.md`, `results.json`, PDFs and `checks/` for exact scope. This is progress on the reader-first objective, not a claim of whole-site completion.

## Reading tools follow-up

`scripts/design-verification/fieldnotes-reading-tools-browser.mjs` exercises actual bundled posts in isolated contexts, light/dark at 320/390/1440. It checks bookmark persistence, search result order and Enter/Shift+Enter/Escape behavior, focus without losing reading position, code expansion, comment Markdown preview, block formatting, discard/continue and failed submission with draft retention. The real three-second submission gate is respected, and the test requires an actual intercepted POST attempt before accepting the failure state. No backend success is simulated.

The same runner checks minimum/maximum size, leading and width through the actual settings controls, persisted after reload, with warm paper/serif and dark variants. Reduced viewport height checks form scrolling and visible submit controls; it is a viewport reflow check, not a claim of a physical on-screen keyboard session.

Summary uses the existing discovery service with an explicit strict-failure option so the new dialog cannot present fallback template text as a successful AI summary. The existing legacy service default remains unchanged. Available/loading/ready/error rendering is wired to actual service state; the local browser environment has AI disabled, so successful generation is not claimed. The existing service failure test covers strict rejection.

Source review also found and corrected search Enter handling on buttons, selection cleanup on unsupported Highlight API browsers, nested-list text concatenation, and returning from comment preview to a hidden textarea. Native Highlight API results do not rewrite React-owned prose. See [MDN's API reference](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API) for the browser facility; the component retains a Selection fallback.

New artifacts are in `verification-screenshots/fieldnotes-reader-review-20260908/reading-tools/`. Printed output is checked visually in addition to text extraction: the first PDF run contained code text in the PDF text layer even though screen compositing/clipping made the code visually blank. Passing text extraction alone did not prove readability. The corrected print removes those effects and was rendered again for inspection.

Final follow-up checks passed: production build, TypeScript, 25 focused unit tests, 149 contracts, ESLint (0 errors / 74 existing warnings), 51 browser regressions and six added real-content scenarios. The latter include all minimum/maximum settings and print checks. Saved `checks/`, `results.json`, four full article PDFs, the two-page generated-cover print excerpt and `print-checks.json` identify the evidence. The final dark code/table page, long-code ending with unavailable-image link, and printed generated cover were rendered with Poppler and visually inspected. These results close the listed toolbar/composer/print findings, not the entire design objective.

## Verification and its limits

Current artifacts live under `frontend/verification-screenshots/fieldnotes-reader-review-20260908/`. `final/` contains actual article, code, table, quote, discussion, image viewer, memo and focus captures. The repeatable runner is `scripts/design-verification/fieldnotes-reader-browser.mjs`.

Saved checks now include a successful production build, TypeScript, ESLint (0 errors/74 existing warnings), 149 contracts, 22 focused unit tests with the TOC rerun after its final change, 51 browser regressions and 32 final real-content captures. The source contract records explicitly explain the TOC observer replacement while retaining original baseline hashes. These results prove the listed checks, not full completion of every reference state.

Public/content checks use real bundled posts. API requests are aborted rather than fulfilled with invented data. The block-capture runner permits the existing public Turndown CDN script, which the real memo tool needs. Local drafts stay in isolated browser contexts. Existing older fixture-based reading regressions are supplementary; their results do not replace real-content visual evidence. No successful backend authentication, comment submission, AI response or deployment is claimed.

An initial 21/48 browser failure run against the long-lived Vite server was inspected: many route failures were HTTP 504 `Outdated Optimize Dep` responses from stale dependency hashes. A fresh production build eliminated those module-loading failures. Four table assertions also assumed every desktop table must overflow; they now check the actual requirement: local scrolling when needed, with no document overflow. The corrected compact table fits at larger widths.

## Still to verify or finish

- Companion metadata follow-up now removes synthetic source tags and internal angle-key badges; meaningful supplied tags and the explicit fallback status remain. Successful remote AI states remain unexercised; do not replace them with demo responses.
- Rich-content coverage now includes actual authored diagrams and the three active iframe embeds. No bundled published Markdown currently contains a video source or Mermaid block, so those renderer capabilities do not have an actual-content visual result to claim.
- Reconcile the original full route inventory with the accumulated evidence. The public/workspace follow-up now covers archive filters/empty search, active debate and all seven numeric status routes, and corrects misleading unavailable secret counts. See `fieldnotes-public-workspace-review.md`. Earlier screenshots establish coverage of captured states, not complete fidelity of every interaction or loaded state.

The full objective is not yet proven complete. Keep the goal active until this remaining audit is resolved with current sources and rendered evidence.
