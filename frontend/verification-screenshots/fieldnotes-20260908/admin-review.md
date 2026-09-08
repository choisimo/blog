# Fieldnotes administrator visual review — 2026-09-08

## Scope and method

The project’s existing `scripts/design-verification/workspace-harness.jsx` renders the real AdminDashboard, all real section managers and the real PostEditorWorkspace. It now imports the same final Fieldnotes styles, in the same order, as `src/main.tsx`. Its MemoryRouter and empty account props are test-entry-only; production authentication and routing are unchanged. The harness does not replace the authentication store or token provider.

System Chromium (`/usr/bin/chromium`) accessed local Vite at `http://127.0.0.1:4317`. External/API requests were aborted at the network boundary; the app rendered its own network-failure states. No API response bodies were substituted. No successful API payloads, worker records, secret values, or operational metrics were invented. No publish, save-to-server, deployment, secret update, or AI execution was performed.

## Captured coverage

The exploratory sweep captured these 20 destinations at 320px and 1440px in light and dark presentation (80 cases). That sweep used the previous harness’s token-provider override. It is historical design evidence, not final NO MOCKS verification:

- health, rag, analytics, logs, config
- content/editor, content/home-cta
- ai/playground, ai/models, ai/providers, ai/routes, ai/monitoring, ai/traces, ai/prompts
- secrets/overview, secrets/secrets, secrets/audit
- workers/workers, workers/secrets, workers/resources

The final inventory includes all 9 section IDs and all 15 subtab IDs. `admin/historical-results.json` retains exploratory measurements with an explicit superseded-harness warning. The first strict parallel sweep timed out after eight health/RAG cases; its cause was unconfirmed, and a standalone Analytics recheck rendered successfully. The completed sequential run then rendered **all 80 cases** with the token override removed, zero runtime errors and zero page/control clipping. `admin/results.json` and its referenced PNGs are the authoritative final record; `admin/strict-run.log` retains only the earlier failed attempt. Scrollable tab strips/tables are intentionally excluded from page-overflow metrics; screenshots were separately inspected for clipping within them.

Additional production `/admin/login` and `/admin/auth/callback` routes and the real standalone new-post editor completed final strict-harness capture at both widths/themes (12 cases), with zero runtime errors or clipping in `admin-auxiliary/results.json`. These captures use no token/response mocks.

Screenshot review used contact sheets of every admin destination, plus full-size inspection of light/dark Health, Analytics, Playground, article editor, login and callback. Full-page PNGs preserve additional content below the viewport. Contact sheets are overview aids, not independent contrast or functional tests.

## Issues found and fixed

1. Old vertical-sidebar nth-child margins staggered two desktop navigation items. Horizontal navigation now resets those offsets explicitly.
2. The 320px editor pane label “미리보기” split mid-word. Compact pane buttons now provide sufficient text width and keep Korean words together.
3. A centered scrollable Playground tab strip clipped its first option. Operator tab strips now align to the start.
4. Health used light-only red fills, dark red text and zinc dividers in dark presentation. Its status and divider utilities now use semantic tokens, preserving error/warning/success meaning.
5. Other legacy admin error/warning/success utilities and primary buttons ignored dark paper contrast. Scoped Fieldnotes adapters now provide the established semantic foreground/background/border tokens.
6. Editor preview quotations inherited a decorative gradient/rounding. The preview uses the reference’s simple ruled quotation surface and serif headings.
7. Home CTA preview had a hardcoded blue button. It now uses the actual primary and primary-foreground tokens.

## Limits, not completion claims

- API-dependent loaded rows, charts, authenticated TOTP success, secret editors with real records, deployments and successful server mutations were not exercised.
- `WorkersManager.tsx:621–667` and `ConfigManager.tsx:501–546` return loading/error views before their loaded layout. The screenshots therefore prove their real unavailable surfaces and surrounding section layout, not loaded worker/resource/configuration controls. Source review confirms loaded branches keep `ui-admin-section`, semantic surface/line tokens, the shared subtab system and existing handlers. This is source evidence only.
- Follow-up resolved the misleading Secrets summary: absent statistics no longer become zero or display “All configured”/“None expiring.” Four actual unauthenticated/retry cases now show neutral Unknown values. See `frontend/docs/design/fieldnotes-public-workspace-review.md` and `frontend/verification-screenshots/fieldnotes-public-review-20260908/secrets-results.json`.
- Login capture follows the current unavailable/bootstrap branch and shows the access-key form; it does not prove every authenticated setup/TOTP state.
- All screenshots use the actual app’s unavailable-state behavior. They are not evidence of live backend health or end-to-end authentication.

## Checks

Actual editor pane-switching and exact multi-paragraph draft preservation passed all four light/dark × 320/1440 cases (`admin-editor-interactions.json`). The modified Health component’s existing suite passes 12/12. Owned admin/Insight/error non-view source contracts remain unchanged. Scoped ESLint previously returned zero errors (six existing react-refresh warnings). The earlier changed-surface suite passed 28/32; the same four navigation/callback expectation failures reproduced against HEAD, documented in `/tmp/fieldnotes-workspace-vitest.json` and `/tmp/fieldnotes-baseline-vitest.json`.

The sequential strict sweep is complete for the actual available component states. Successful API-dependent loaded-state QA still requires an existing authorized session/backend, and no substitute was introduced. The final integrated frontend also passes 149 source/pure-function contracts, 34 focused tests, type-check, lint and production build; see `frontend/docs/design/fieldnotes-refactor.md` for the complete frontend scope.
