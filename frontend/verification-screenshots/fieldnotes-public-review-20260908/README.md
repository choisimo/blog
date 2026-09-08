# Public/workspace state evidence

From `frontend/`, against the production preview and the fresh Vite harness respectively:

```sh
DESIGN_BASE_URL=http://127.0.0.1:4319 node scripts/design-verification/fieldnotes-public-states-browser.mjs
DESIGN_BASE_URL=http://127.0.0.1:4321 node scripts/design-verification/fieldnotes-secrets-state-browser.mjs
```

All six public cases and four real Secrets unavailable/retry cases passed. The public cases contain 42 numeric error-route visits in addition to archive/debate flows. The initial archive runner needed its mobile filter opener, an explicit empty-state reset scope, and a wait for tag-search debounce; these runner corrections did not change app data. Final tag screenshots represent filtered results, not pending debounce.

`checks/` contains a successful production build, TypeScript, ESLint (0 errors/74 existing warnings), 149 contracts, 12 focused component tests plus one Lens hook test, six public state cases and the repeated six-case companion run (ten quiz answers each). The 51 browser regression pass preceded the final Secrets/metadata changes; those final changes have their focused tests and actual four/six-case runtime checks after rebuilding.

The Secrets script records the same four-case flow initially executed inline against actual components; no token, hook or response is overridden. The explicit source-contract amendments preserve baseline hashes and explain why missing counts must not become zero. Successful authentication, server writes and generated AI responses are outside this evidence.

The source/decision review is `frontend/docs/design/fieldnotes-public-workspace-review.md`. These checks prove the recorded states and fixes, not an unqualified completion of the entire reference design.
