# A02 verification evidence

Scope: source-level implementation and isolated tests, not production acceptance.
Base archive: blog-integrated-r07-1-20260910.zip (2031 regular files).

- `contracts.tap`: 97 passing isolated A02 tests (server 66, observation 13, dispatch 8, backend callback 10).
- `regression-anonymous.tap`: 84 passing existing R07-1 isolated tests.
- `regression-images.tap`: 26 passing existing reader image contracts.
- `regression-seo.tap`: 112 passing existing A01 unit tests.
- `syntax.json`: parser/transpiler results for changed/added source and declaration files. Not a typecheck.
- `source-changes.json`: exact comparison to the input archive, including modified, added and missing paths.
- `dependency-attempt.log`: actual failed offline dependency installation (cache miss).
- `runtime-gates.log`: actual unsuccessful locked workspace gate attempts (missing types, React, Vitest, dependencies).

The individual `server.tap`, `observer.tap`, `dispatch.tap` files document intermediate runs.
`contracts.tap` is the final aggregate run and supersedes those intermediate counts.
Tests are not counted twice merely because they were rerun.

Fixtures are explicit in scripts/verification/a02/support.cjs and test files. SQL and targeted migrations
execute on Node SQLite, including independent connection contention. Hono registration/config adapters,
HTTP/provider results and clocks are fixture boundaries. The backend /generate test extracts and executes
the real callback from the AST with Express/AI/idempotency wrappers supplied by the test.
No production dependency or secrets module was replaced by a stub.

Real Hono/D1 tests (21), shared Zod tests (6), React parser/header/page tests, whole builds, actual Backend–Worker
SSE/crons and staging remain unverified. No paid generation or remote deployment was performed.

Reproduce isolated checks at the repository root: `npm run verify:translation`.
The package excludes .git, newly generated build caches and node_modules, not existing source files.
