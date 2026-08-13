# Flutter Admin current-state audit and hardening report

Date: 2026-08-12–2026-08-13
Scope ID: `flutter-admin-current-state`
Plan ID: `fa-audit-20260812`
Contract version: `1.0`
Risk register version: `1`

## Executive verdict

The Flutter Linux admin console now passes its local static, test, visual, and release-build gates after the hardening described below. The repository is still a **production NO-GO** until the open operational and dependency risks are resolved and a deployed environment is exercised.

The most important initial defects were confirmed from execution paths rather than inferred from filenames:

- concurrent refresh requests could collide with server-side refresh-token rotation and revoke a valid token family;
- a signed admin refresh JWT could read the configured TOTP seed;
- four named secrets routes were shadowed by Hono's earlier `/:id` route;
- an arbitrary HTTPS base URL could receive stored Bearer tokens;
- finite requests had no deadline, destructive actions had no common safety policy, and page navigation discarded drafts while repeating automatic requests;
- the TOTP setup UI expected `qrDataUrl`, while the Worker returns `otpauthUri`;
- config request examples and create-post slug handling disagreed with backend contracts;
- there was no Flutter CI or visual regression gate.

Those defects have been corrected locally and are covered by focused tests. Static endpoint registration is fully inventoried; deployed behavior, credentials, observability, rollback, and capacity remain incomplete evidence.

## Evidence classification

- **Confirmed**: directly observed in source, registration, test output, build output, or a focused runtime reproduction.
- **Inferred**: strongly implied by confirmed paths but not reproduced against production.
- **Unknown**: requires deployment state, credentials, traffic, or measurements unavailable in this workspace.

## Runtime topology and ownership

```text
linux/runner/main.cc
  -> lib/main.dart
  -> AuthStore.init
  -> stable MaterialApp + AuthGate
       | anonymous -> LoginPage
       ` authenticated -> DashboardPage
            -> lazy, state-preserving destination host
            -> feature page
            -> AdminApiClient + AuthStore
            -> https://api.nodove.com
                 | Worker-native Hono handler
                 ` signed backend proxy
                      -> Express backend
                      -> D1 / KV / R2 / filesystem / GitHub / AI services
```

Confirmed entrypoints and seams:

- Linux host: `linux/runner/main.cc` and `linux/runner/my_application.cc`.
- Dart composition root: [`lib/main.dart`](./lib/main.dart).
- Session persistence and authentication HTTP: [`lib/core/auth_store.dart`](./lib/core/auth_store.dart).
- authenticated JSON, multipart, and streaming transport: [`lib/core/api_client.dart`](./lib/core/api_client.dart).
- destination registry and adaptive shell: [`lib/pages/dashboard_page.dart`](./lib/pages/dashboard_page.dart).
- Worker registration: [`../workers/api-gateway/src/routes/registry.ts`](../workers/api-gateway/src/routes/registry.ts).
- Worker-to-backend fallthrough: [`../workers/api-gateway/src/index.ts`](../workers/api-gateway/src/index.ts).
- backend route registry: [`../backend/src/routes/registry.js`](../backend/src/routes/registry.js).
- cross-service ownership contract: [`../shared/src/contracts/service-boundaries.js`](../shared/src/contracts/service-boundaries.js).

The current style is a page-centric transaction-script UI over shared auth and HTTP infrastructure. Pages still own paths, request JSON, parsing, and most domain policy. Reusable fields, navigation, theming, request state, result rendering, and confirmation policy are now presentation-only components; typed feature services and DTOs remain future boundary work.

## Endpoint inventory

The exact inventory is maintained in [`API_SURFACE.md`](./API_SURFACE.md).

- Confirmed unique contracts: **103 method + path patterns**.
- Confirmed reachable from UI, automatic refresh, or stream paths: **102**.
- Implemented but currently unused: `GET /api/v1/auth/me` through `AuthStore.getMe`.
- Additional protocol: one line-oriented SSE connection, `GET /api/v1/admin/logs/stream`.
- Direct platform boundaries: secure storage, shared preferences migration, file picker, and external URL launcher.
- Static registration and ownership mapping: complete.
- Production deployment parity and full response-schema validation: unknown.

Transaction boundaries are not uniform:

- Worker-native secrets/auth operations use KV and D1 directly.
- many admin mutations are signed-proxy calls to Express;
- create-post and several GitHub operations commit a backend outbox event before external work occurs;
- session mutations are serialized and generation/origin-fenced; secure token writes remain multiple OS operations, while incomplete pairs are detected and cleared on initialization;
- automatic `Idempotency-Key` headers reduce retry risk only where the receiving server implements deduplication.

## End-to-end trace: refresh rotation

Canonical initial state:

```text
client: access token expired, refresh token active, origin binding valid
server: refresh jti active, family not revoked
```

1. A page action asks `AdminApiClient` for an authenticated request.
2. `AuthStore.getValidAccessToken` decodes the local JWT expiry with a 60-second buffer.
3. Every concurrent caller joins one `_refreshInFlight` future.
4. The Worker validates token type, admin role, verified email, jti, family, and current record.
5. The Worker performs compare-and-swap rotation and issues a replacement pair.
6. Every session-storage mutation is serialized. Logout and origin changes synchronously advance a generation fence before any storage await.
7. The client commits the rotated pair only if the initiating refresh token, generation, and API origin still match; otherwise queued clearing wins and removes any in-progress stale write.
8. The client stores the API origin binding and new secure token pair; partial pairs are rejected on the next initialization.
9. A 401 retries once. Mutation retry reuses the same idempotency key.
10. Invalid/revoked refresh responses clear the session. Network failures, timeouts, 408, 429, and 5xx preserve it for retry.

Confirmed invariant after the change: one local refresh token is rotated at most once concurrently, and neither logout nor an origin change can be undone by an in-progress refresh persistence operation. Controlled completer tests exercise both interleavings. Focused tests also prove transient failures retain credentials and 401 mutation retries retain one key.

Remaining uncertainty: serialization and generation fencing control in-process races, but secure-storage writes are still multiple OS operations. A process crash between token writes can leave a mismatched pair that is only rejected when a later refresh fails; a single-record session format would close that crash-consistency gap.

## End-to-end trace: create post PR

1. `NewPostPage` normalizes title, explicit slug, year, tags, frontmatter, and Markdown.
2. It creates one idempotency key for the logical attempt and retains it across transient retries; a successful response rotates the key for the next intent.
3. `AdminApiClient` sends Bearer authentication, request ID policy, a finite deadline, and the stable key.
4. The Gateway enforces the route ownership boundary, strips client origin-signature headers, signs the request, and proxies it to the backend.
5. Express admin authorization validates an admin access token or its configured compatibility credential.
6. The backend now normalizes the explicit `slug` when supplied and falls back to the title only when it is absent.
7. The backend hashes the canonical create-post request and appends that fingerprint with `github.pr.create-post` to the domain outbox under the supplied idempotency key.
8. A matching retry returns the original outbox ID, branch, and path. Reusing the key with a different canonical payload returns 409 instead of silently replaying old content.
9. HTTP 202 returns `pending`, `outboxId`, branch, and path before GitHub work completes.
10. The scheduled or manually flushed worker creates the branch/file/PR and marks the outbox event succeeded, failed, or dead-letter.

Confirmed remaining gap: the Flutter page shows the accepted event but does not bind it to automatic outbox polling. The backend repository can fall back to memory when D1 is unavailable, so restart durability under that degraded mode is not guaranteed.

## State machines and invariants

| Owner | States | Guard / invariant | Current failure policy |
|---|---|---|---|
| Auth gate | uninitialized -> anonymous/authenticated | both normalized tokens and matching stored origin are required | invalid or partial storage clears local session |
| Access token | valid -> refreshing -> rotated/retryable/anonymous | one in-flight refresh; serialized storage; token + generation + origin must still own commit | transient transport/server failure is retryable; logout/origin change wins; invalid refresh logs out |
| Login | loading -> setup gate/setup/login/handoff | setup and login responses must match token/setup contracts | failure exposes a retry action instead of trapping the loading state |
| Destination shell | unvisited -> active -> inactive/active | create only on first visit; stable keys preserve draft/result/tab state | inactive animations pause; bounded logs may remain active by declared policy |
| Action card | idle -> loading -> success/error -> idle | non-read actions cannot auto-run; destructive actions require confirmation | duplicate click disabled; stale result cleared; sensitive result can expire |
| Log stream | stopped -> subscribed -> stopped/error | at most 200 visible rows; UI publication batched every 75 ms | error/done clears subscription; disposal cancels timer and stream |
| Create-post attempt | draft -> pending outbox -> external success/failure | explicit slug and one stable attempt key | UI has no automatic terminal-state follow-up |
| Backend outbox | pending -> processing -> succeeded/failed/dead-letter | claim/lease/retry repository rules | D1 degraded memory fallback can lose work on restart |

## Security boundary results

Resolved and proved locally:

- TOTP setup after enrollment accepts only `type=access`, `role=admin`, `emailVerified=true`; refresh and unverified tokens cannot receive the seed.
- TOTP challenge and verify operations are rate-limited by a hashed trusted `CF-Connecting-IP`; rotating User-Agent cannot reset the bucket, and missing edge IPs share a conservative bucket. The ninth verification attempt in a five-minute window receives 429.
- API origins require HTTPS, except loopback development; credentials, path, query, and fragment are rejected.
- non-loopback origins must equal the build-time default or appear in `ADMIN_API_ALLOWED_ORIGINS`.
- changing origin clears the session, and stored tokens are bound to their issuing origin in secure storage.
- token strings reject whitespace, controls, encoded CR/LF, empty values, and excessive length.
- production secret reveal/plaintext export collects an eight-character break-glass reason; destructive actions require confirmation; sensitive results auto-clear after 30 seconds.
- backend/root `.env` overwrite is classified as destructive and requires explicit consequence confirmation.
- four named secrets GET routes now register before `/:id`, with route-dispatch contract tests.

Open security/operational risks:

- Cloudflare Access remains an optional additional layer. Complete absence of `CF_ACCESS_AUD` and `CF_TEAM_DOMAIN` intentionally bypasses IAP because public routes share the Worker; production enforcement cannot be proved from repository state.
- TOTP rate limiting uses the shared KV helper, which is best-effort and fails open with a degradation header if KV itself is unavailable. Its KV read/write increment is also non-atomic, so parallel bursts require an atomic edge, Durable Object, or equivalent production limiter.
- raw map/request contracts still allow schema drift outside the specifically tested setup, config, secrets, and create-post paths.
- server support for idempotency is inconsistent; a client header alone cannot make every external mutation exactly once.
- secret bulk import is a loop of independent writes rather than one transaction.
- no production credential, Cloudflare Access session, keyring/libsecret instance, or live secret-encryption key was exercised.

## Frontend architecture decision

Decision: use one canonical destination registry and a lazy, state-preserving adaptive shell.

- `320-599`: drawer, single-column controls, 48x48 minimum actions.
- `600-959`: compact navigation with controls wrapping only when each is at least 280 logical pixels.
- `>=960`: persistent, scrollable navigation rail and content capped at 1320 pixels.
- visited pages remain mounted with stable keys and `TickerMode`; unvisited pages do not construct or auto-run.
- `MaterialApp` remains stable; only `AuthGate` listens to `AuthStore`.
- state ownership is auth/store -> shell selection/visited set -> page draft -> action request state.
- route-ready destination path segments are recorded, but a router dependency is deferred until deep links/history are required.

Rejected alternatives:

- the original `switch`, because it discarded drafts and repeated automatic work;
- an eager `IndexedStack`, because 32 initial auto-run declarations could create a network/render burst;
- intrinsic-height grid measurement, because it adds speculative layout; a `LayoutBuilder + Wrap` retains natural child height;
- an immediate global state/router rewrite, because it does not address the highest-risk lifecycle defects proportionally.

## Design system and interaction contract

[`lib/theme/admin_theme.dart`](./lib/theme/admin_theme.dart) defines light/dark color, spacing, radius, breakpoint, content-width, semantic status, focus, control-size, and motion tokens.

The common action component now provides:

- explicit read, mutation, and destructive kinds across all 91 call sites, including 22 destructive operations;
- compile-time-required action classification;
- required confirmation copy and stable action IDs for destructive operations;
- idle, loading, success, and error state; duplicate suppression; retry-safe stale-result clearing;
- accessible live-region announcements, keyboard-focusable dialogs, disabled/loading controls, and dismissible error/result states;
- a 100 KiB eager JSON formatting cap;
- 30-second expiry for plaintext secret reveal/export results.

Golden render evidence:

- [`verification/admin-dashboard-desktop.png`](./verification/admin-dashboard-desktop.png)
- [`verification/admin-dashboard-mobile-drawer.png`](./verification/admin-dashboard-mobile-drawer.png)
- [`verification/admin-dashboard-dark.png`](./verification/admin-dashboard-dark.png)

Widget evidence covers exact 599/600 and 959/960 boundaries, 320-pixel width, 200% text scale, 48-pixel targets, state preservation, confirmation, stale results, setup URI, break-glass requests, SSE batching, and Markdown debounce.

## Rendering and event audit

Initial confirmed waterfalls:

```text
Health mount -> four auto-run microtasks -> repeated loading/result rebuilds
             -> concurrent auth refresh candidates -> synchronous JSON format

SSE chunk -> LineSplitter -> setState per line -> full LogsPage rebuild

Markdown key -> whole ContentPage setState -> Markdown parse every key
```

Current corrections:

- the default Health destination auto-runs only two public reads;
- lazy destination construction prevents unvisited network work and repeat mounts;
- refresh is single-flight;
- JSON formatting is memoized outside `build` and capped for large payloads;
- SSE data is parsed, bounded to 200 rows, isolated with a notifier, and committed every 75 ms;
- Markdown preview is isolated and debounced by 200 ms;
- fixed-aspect nested grids were replaced by intrinsic-height wrapping controls;
- broad `MaterialApp` rebuilding was replaced by a narrow auth gate;
- render-heavy pages are retained behind repaint boundaries.

Acceptance budget for profile measurements:

- p95 total frame <=16.7 ms at 60 Hz;
- build <=8 ms and raster <=8 ms during typing, navigation, and streaming;
- no interaction frame above 100 ms;
- at most one SSE UI commit per frame and 200 retained rows;
- no eager JSON format/layout above 100 KiB;
- no more than two initial automatic network operations;
- profile at 320, 600, 960, and 1440 widths and text scale 2.

The structural and event-frequency constraints are tested. Actual profile-mode p95 build/raster/heap numbers remain unknown because no production-like stream rate or representative payload corpus was available.

## Operations and release readiness

Added [`../.github/workflows/validate-admin-flutter.yml`](../.github/workflows/validate-admin-flutter.yml) with an exact Flutter toolchain, format, analyze, full test/golden, and Linux release-build gates.

Confirmed local gates:

- Flutter 3.44.2 / Dart 3.12.2;
- `flutter analyze --no-pub` passes;
- full Flutter tests pass: 34/34;
- Linux release build passes;
- full Worker tests pass: 142/142, and Worker TypeScript typecheck passes;
- full backend tests pass: 112 passed, 1 skipped, 0 failed;
- `git diff --check` passes.

Release blockers and unknowns:

- backend `npm audit --omit=dev` reports 7 high and 4 moderate advisories, including `jws`, `path-to-regexp`, `sharp`, and `ws`; dependency remediation needs its own compatibility-tested change.
- no deployed smoke test, production credential, rollback rehearsal, release channel, installer/update path, SLO, alert, dashboard, or incident runbook was found for this Flutter console.
- no measured production request latency, SSE rate, payload size distribution, memory ceiling, or capacity plan is available.
- readiness cannot prove external GitHub, R2, D1, KV, AI, backend-origin signing, or secure-storage availability from a release build alone.
- Flutter dependencies have available upgrades; major file-picker/secure-storage/lint migrations were not mixed into this hardening change.

## Test-invariant coverage

New or strengthened tests prove:

- API origin validation, allowlisting, session clearing, and secure origin binding;
- plaintext token migration and malformed-token rejection;
- concurrent refresh single-flight, transient-failure retention, and refresh-versus-logout/origin-change persistence races;
- finite request deadlines and mutation/multipart idempotency-key reuse;
- authenticated JSON, multipart, and streaming 401 retry;
- lazy destination creation, draft retention, and breakpoint state retention;
- intrinsic-height control behavior at boundary widths and large text;
- destructive confirmation, duplicate disabling, error state, stale-result removal, and illegal mutation auto-run assertion;
- setup `otpauthUri`, secret break-glass body/header, config request examples, and destructive `.env` overwrite confirmation;
- Markdown debounce and disposal; SSE parsing, batching, cap, completion, and error reset;
- TOTP token class/verification, seed non-leak, rotating-User-Agent/missing-IP rate limits, refresh family reuse, OAuth handoff, and named secrets route dispatch;
- explicit post-slug normalization, original outbox response replay, changed-payload key conflict, and backend config serialization.

Important missing invariant tests:

- live endpoint smoke coverage for all 103 contracts;
- every raw request/response schema and authorization matrix;
- server-side dedupe behavior for each privileged mutation;
- atomic parallel-burst enforcement for TOTP attempt limits;
- concurrent secret import rollback and outbox failure/recovery under real D1 loss;
- actual screen reader traversal and platform keyring behavior;
- profile-mode frame/heap thresholds with production-sized JSON and log traffic;
- deployment, rollback, and upgrade behavior.

## Legacy and compatibility ledger

- plaintext preference-token migration is active and tested; define telemetry and a removal release before deleting it.
- the old loopback default migration is active and tested.
- legacy KV-backed TOTP challenge consumption remains a fallback behind stateless signed challenges; remove only after usage evidence.
- refresh KV-to-D1 hydration remains an active migration boundary.
- create-post outbox events created before request fingerprints remain replay-compatible, but historical mismatched-payload key reuse cannot be distinguished.
- backend `ADMIN_BEARER_TOKEN` remains a compatibility auth path; do not remove without caller evidence.
- legacy admin username/password configuration names remain in some Worker manifests/registries even though the app uses TOTP/OAuth.
- `AuthStore.getMe` is implemented but unused; either integrate verified-session bootstrap or remove it after contract review.

## Prioritized risk register

| Priority | Current risk | Evidence / next action |
|---|---|---|
| P0 release gate | No production/deployment proof | Execute authenticated smoke, readiness dependencies, secure storage, rollback, and alert checks in a controlled environment. |
| P1 security | Backend dependency advisories | Upgrade non-breaking dependencies first, isolate breaking `sharp` migration, rerun the full backend suite and image paths. |
| P1 auth | TOTP KV limiter is non-atomic and fails open during KV loss | Add an atomic edge/Durable Object limiter and parallel-burst/degraded-storage release tests. |
| P1 consistency | Partial idempotency and degraded outbox durability | Create-post replay is now payload-bound; inventory the remaining receivers, add keys/claims to every external mutation, and remove or persist memory fallback. |
| P1 secrets | Bulk import is non-transactional | Validate full payload, wrap supported writes in a transaction, emit one auditable outcome, define rollback. |
| P1 operations | No SLO/alerts/runbook/update channel | Define auth failure, refresh failure, privileged mutation, SSE, latency, and crash SLOs plus rollback/update ownership. |
| P2 contracts | Page-owned raw maps | Introduce typed feature clients/DTOs incrementally around secrets, workers, config, and outbox first. |
| P2 performance | Profile numbers are unknown | Capture DevTools/profile data with representative payloads and enforce the documented budgets. |
| P2 lifecycle | Inactive bounded log stream remains connected by policy | Add explicit pause/resume if operators do not need background collection. |
| P2 session | Multi-key secure-storage crash window | Migrate the origin and token pair to one versioned secure session record with compatibility telemetry. |
| P2 dependencies | Flutter packages are behind resolvable versions | Schedule secure-storage/file-picker migration with Linux keyring and upload regression tests. |

## Conflict notes

- The earlier API document grouped collection methods and omitted provider health; the inventory is now exact and counts duplicate feature use once.
- The Worker returns `otpauthUri`, not `qrDataUrl`; the app now supports that contract and treats a data-URL QR as optional compatibility input.
- Secrets overview/health/audit/export were documented as available while route order made them unreachable; registration and runtime contract tests now agree.
- The app's explicit post slug was formerly ignored by the backend; both sides now normalize the same explicit field.
- A mobile layout contract is tested, but the repository contains only a Linux host scaffold. Android/iOS packaging remains out of scope and unproven.
- Local release quality is green; this does not override the production NO-GO caused by deployment evidence and open operational/security items.
