# R07-1 verification boundary

- `contracts.tap`: 84 production-service/crypto/SQLite/client-runtime checks. Transport, browser Storage and Zustand are isolated fixtures. Not the full Worker app.
- `seo-regression.tap`: unchanged A01 Node suite, 112 passed. Not actual HTMLRewriter.
- `image-regression.tap`: 26 existing image policy/repository checks, using SQLite.
- `browser-fixture.json`: 6 production memo DOM/auth checks with memory Storage, fixture fetch, inlined styles/module-loader substitution. Not actual persistence, cross-tab locking or React dialog rendering.
- `browser-runtime-attempt.json`: actual-origin Chromium navigation was blocked by environment policy. No cross-tab/persistence success is claimed.
- `worker-runtime-attempt.log`: Vitest was missing; the added Hono/Workers integration tests did not execute.
- `worker-typecheck.log`: full Worker typecheck could not start without Workers/Vitest/Node types.
- `a01-install-attempt.log`: offline npm install failed on an uncached dependency; network registry DNS was also unavailable.
- `baseline-missing-imports.json`: existing route registry imports `./secrets`, absent from the supplied source archives. Do not replace it with a stub.
- `syntax.json`: parse/transpile diagnostics for changed JS/TS only, not a semantic build.
- `source-changes.json`: differences from the supplied integrated A01 ZIP. Package delivery checks are provided separately.
