# Public and workspace state review

Reference: `/home/nodove/다운로드/nodove-fieldnotes-reader-refined.html`. This continues the full frontend design objective after the reader review. Earlier static route captures are retained; they do not substitute for inspecting reachable interaction states.

## Confirmed gaps and changes

| Surface | Observed gap | Change and boundary |
| --- | --- | --- |
| Archive mobile filters | The sheet is a portal outside `.fn-archive`; category controls and tag pills therefore missed the archive rules | Scope the same restrained borders/radii to the actual filter component, including the portal; preserve URL filters, search, sorting and pagination |
| Active debate room | Entry page was adapted but the room retained a second outer card, large rounded cards, gradients and decorative shadows | A single ruled paper surface, neutral intent icons, 44px actions, readable 16px composer, restrained response treatment and reduced motion; same intent/service/message owners |
| Korean message composition | Enter did not distinguish IME composition from an intentional send | Ignore composing Enter; preserve ordinary Enter and Shift+Enter behavior; add an explicit textarea name |
| Secret overview unavailable state | Absent counts became zero and displayed green “All configured” / “None expiring” alongside an authentication error | Preserve absent statistics as unknown and use neutral text; actual nonzero/zero loaded branches and API hooks remain intact |
| Paragraph perspective metadata | Transport tags `fallback`/`feed`/`prism` and internal angle keys were printed as reader-facing badges | Remove synthetic source tags from facet-to-card presentation mapping and the angle-key badge; meaningful supplied tags, IDs, status and exploration ownership remain |

The secrets declaration gate initially rejected removal of the two `?? 0` defaults. Two explicit amendments now record the behavior correction, original hashes, reason and test path. The original baseline is retained. This is an intentional unavailable-versus-zero distinction, not an assertion that state behavior is unchanged.

## Actual runtime evidence

`scripts/design-verification/fieldnotes-public-states-browser.mjs` uses the production preview, real bundled posts, light/dark at 320/390/1440 and API/external request aborts without response substitutes. It checks filtered tag results after debounce, tag selection/restoration after reload, real empty-search/reset, portal focus return, all four debate intents, actual request failure, composing Enter without a request, multi-line editing, reduced viewport height and retained topic/context on close. It also checks the seven numeric status routes at all six combinations for rendered headings and page overflow. The short-height cases are viewport reflow checks, not physical keyboard testing. Successful remote AI output is not claimed.

The real administrator harness ran at a fresh Vite server on port 4321, with no token or authentication overrides, at 320/1440 in both themes. All four Secrets overview cases showed four Unknown values, no success labels, an actual unauthenticated error, and the same result after retry; no runtime errors or document overflow occurred. The API's unavailable outcome was rendered by its existing hook. No secret values or invented operational records were supplied.

Artifacts and checks are in `verification-screenshots/fieldnotes-public-review-20260908/`. `results.json` identifies public scenarios; `secrets-results.json` identifies actual administrator cases. The earlier broader 80-state manager review remains at `verification-screenshots/fieldnotes-20260908/admin-review.md`; its known misleading secret-count finding is corrected by this follow-up.

Final checks passed: build, TypeScript, lint (0 errors/74 existing warnings), 149 contracts, 12 focused component tests and one Lens hook test; six public cases and four Secrets cases; the repeated six-case companion suite completed all ten quiz answers in every case. The 51 broader browser regressions passed before the final Secrets/metadata change, which was rechecked with focused runtime evidence after rebuilding. Final screenshots were inspected for the mobile filter, desktop/mobile conversation including the 500px-tall viewport, dark unavailable Secrets and cleaned perspective metadata. The Secrets reproduction is now saved as `scripts/design-verification/fieldnotes-secrets-state-browser.mjs`.

## Review scope and remaining audit

Scoped source review checked portal ancestry, responsive layout, intent/service ownership, IME behavior, URL filter state and the distinction between absent and zero counts. Current loaded secret statistics still use the existing typed response and hook; stale refresh/partial backend failure semantics were not redesigned. CSS retains the terminal branch. Existing fabricated-response unit tests are supplementary legacy checks; the new runtime evidence does not fabricate responses.

The reference's admin prototype deliberately shows unknown metrics before connecting to an authenticated app. Its local editor/contact/AI demonstration data is not production content to copy. Remaining whole-site completion work is to reconcile the original route/surface inventory with the accumulated current evidence, including global overlays and public/workspace states that earlier screenshots did not exercise. Successful backend authentication or live AI availability has not been established by these design checks.
