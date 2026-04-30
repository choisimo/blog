# ADR: Option B Home Layout With Managed Markdown CTA

Date: 2026-04-29
Status: Proposed

## Context

The public home page is currently implemented as a single page component in
`frontend/src/pages/public/Index.tsx`. Data loading, fallback selection, search
state, recently viewed state, category derivation, and all lower-home UI sections
live in that file.

Evidence:
- `Index` owns latest post, search, category, editor pick, and recently viewed
  state in one component at `frontend/src/pages/public/Index.tsx:72`.
- Editor picks are hard-coded to a 3-item fetch and fallback path at
  `frontend/src/pages/public/Index.tsx:131`, `:162`, and `:172`.
- The current lower-home UI is embedded directly as JSX from Editor's Picks
  through Latest Posts at `frontend/src/pages/public/Index.tsx:431`.
- Recently Viewed is a home-page section at
  `frontend/src/pages/public/Index.tsx:625`, but Option B does not include it in
  the requested lower-home layout.
- Categories and Latest Posts are also inline, at
  `frontend/src/pages/public/Index.tsx:733` and `:807`.
- Admin navigation has no content-management surface. Its tab union and tab list
  end at `health | rag | analytics | logs | ai | config | secrets | workers` in
  `frontend/src/pages/admin/AdminDashboard.tsx:25`.
- Worker routes are registered centrally in
  `workers/api-gateway/src/routes/registry.ts:44`, so any new public/admin
  content API needs an explicit route boundary instead of ad hoc calls.

The existing system already has useful building blocks:
- Public editor-pick reads and admin editor-pick writes exist under analytics.
- `SafeDescriptionMarkdown` can render constrained markdown without raw HTML for
  small public UI blocks.
- Admin auth, `adminApiFetch`, D1, and Worker route registration patterns already
  exist.

## Decision

Adopt a strangler-style home architecture:

1. Extract the lower-home surface into feature-level home components:
   `HomeEditorPicksSection`, `HomeCategoryStrip`, `HomeLatestPostsSection`, and
   `HomeMarkdownCta`.
2. Keep `Index.tsx` as the composition owner during migration, but move visual
   section responsibility and typed props into `components/features/home`.
3. Introduce a new `site-content` boundary for managed public content blocks.
   The first block key is `home_ai_cta`.
4. Split the Worker boundary into route, use-case, repository port, and D1
   adapter files before implementation. The route remains unregistered until the
   coder phase completes tests and contract updates.
5. Add a future admin `ContentManager` surface separate from `ConfigManager`.
   Public content is not environment configuration.

This keeps current home behavior intact while allowing one lower-home section at
a time to move behind new typed components.

## Alternatives

### Edit `Index.tsx` Directly

Rejected. It would be fast, but it increases the existing monolith and makes the
admin markdown CTA harder to test independently.

### Reuse `ConfigManager`

Rejected. `ConfigManager` is an environment-variable UI and saves env-like
values. Public homepage markdown is editorial content and needs different
validation, fallback, audit, cache, and preview behavior.

### Store CTA Markdown In Static `site.ts`

Rejected. It would be safe and cheap, but the user explicitly wants admin-editable
markdown.

### Put CTA Markdown Under Analytics

Rejected. Analytics already owns editor-pick curation, but managed copy is not
analytics data. Combining them would blur ownership and make route boundaries less
clear.

## Consequences

Benefits:
- The Option B layout can be migrated section by section with low blast radius.
- Admin-editable markdown is isolated behind a content-block contract.
- The public API can serve a safe fallback when D1 or admin content is missing.
- Tests can target each home section and content-block use case separately.

Costs:
- More files and route-boundary plumbing before visible UI changes.
- A new D1-backed content table or equivalent storage must be implemented in the
  coder phase.
- The route-governance contract must be updated when the route is registered.

## Coexistence Strategy

Use dual path migration:

1. Keep current `Index.tsx` rendering as the default.
2. Implement extracted home sections behind a local composition switch or staged
   PR, not a public runtime flag at first.
3. Replace the current lower-home JSX from `Editor's Picks` downward only after
   the extracted sections match current data behavior.
4. Register `site-content` routes only after Worker route tests and public
   fallback behavior are in place.
5. Add Admin Dashboard `Content` tab only after the public read path exists.

## Rollback Guardrails

Rollback points:
- Before route registration: delete or ignore the scaffolded `site-content`
  files. No runtime behavior changes.
- After route registration but before home usage: remove the registry entry and
  service-boundary entry. Public home remains unchanged.
- After home usage: switch `Index.tsx` back to the old inline lower-home block or
  disable the new lower-home composition flag.
- After admin content UI: keep public fallback markdown in the frontend so an
  empty or failing content API does not blank the CTA.

Completion gates:
- Frontend type-check passes.
- Worker type-check passes.
- Route-governance snapshot is updated only when the new route is registered.
- Public markdown rendering uses the constrained renderer, not raw HTML.
- Home visual regression is checked at desktop and mobile widths.

## Scaffolded Boundaries

Frontend:
- `frontend/src/components/features/home/*`: Option B section component
  contracts.
- `frontend/src/services/content/site-content/*`: public/admin content-block
  client contracts.
- `frontend/src/components/features/admin/content/*`: future admin content UI
  contract.

Worker:
- `workers/api-gateway/src/routes/site-content/index.ts`: route boundary stub.
- `workers/api-gateway/src/domain/site-content/types.ts`: content-block domain
  contract.
- `workers/api-gateway/src/ports/site-content/SiteContentRepository.ts`: storage
  port.
- `workers/api-gateway/src/use-cases/site-content/*`: read/save use-case
  contracts.
- `workers/api-gateway/src/adapters/site-content/d1SiteContentRepository.ts`:
  D1 adapter factory contract.

## Coder Delegation

1. Implement the D1 migration for `site_content_blocks` with unique block key,
   markdown body, CTA metadata, enabled state, timestamps, and changed-by field.
2. Implement the Worker repository adapter and use cases with length validation,
   block-key allowlist, and safe public fallback.
3. Add and register `site-content` routes after route-boundary contracts are
   updated.
4. Implement frontend site-content client functions and tests.
5. Implement `HomeMarkdownCta` using `SafeDescriptionMarkdown`.
6. Extract and replace lower-home sections in `Index.tsx` with Option B layout.
7. Add Admin Dashboard `Content` tab and `ContentManager` markdown editor with
   preview.
8. Run frontend type-check/tests, Worker tests, route-governance check, and
   desktop/mobile screenshot verification.
