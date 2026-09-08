# Fieldnotes route and surface inventory

Initial source inventory, 2026-09-08; component line numbers and mismatch notes below describe the pre-refactor state. Current routing source of truth: frontend/src/App.tsx. The ancestor /home/nodove/workspace/AGENTS.md, frontend/AGENTS.md and frontend/src/components/AGENTS.md apply. Explore skill read. Do not hand-edit shadcn ui/ or CI-generated public manifests; keep real features/data/auth and existing behavioral contracts.

## Routed surfaces

| URL | Actual component/surface | Shared layout / design seam |
|---|---|---|
| / | pages/public/Index.tsx | ui-home-*; home hero, category strip, editor picks, latest rows, search and markdown CTA; styles/ui-home.css |
| /blog | pages/public/Blog.tsx:331 | ui-blog-page; search, filters, discovery, list, pagination; styles/ui-pages.css; deliberately hides global assistant |
| /blog/:year/:slug and /post/:year/:slug | pages/public/BlogPost.tsx:866 | ui-article-page/container/layout/article, right TOC (:954), BlogPostHeader/Content/Related and ArticleQuickActions; ui-reading.css; translation, comments, diagrams, images and memo workflows |
| /projects | pages/public/Projects.tsx:131 | ui-projects-page; category/tag/search and grid/list view, ProjectModal; ui-projects.css |
| /about | pages/public/About.tsx:162 | ui-about-page; biography sections, contact, skill rows; ui-pages.css |
| /contact | Navigate /about | no separate form route |
| /debate | pages/public/Debate.tsx:93 | ui-debate-page; topic/context entry then active DebateRoom; ui-pages.css and feature dialogue surfaces |
| /insight | pages/public/Insight.tsx | direct re-export of features/insight-workspace/InsightWorkspacePage.tsx; graph, persistent explorer/inspector panes, stack controls; ui-insight.css/ui-workspaces.css |
| /400 /401 /403 /404 /429 /500 /503 | BadRequest, Unauthorized, Forbidden, NotFound, TooManyRequests, ServerError, ServiceUnavailable wrappers | all pages/public/errors/ErrorStatusPage.tsx + presets.ts; ui-error-page; preserve status-specific advice/actions |
| /bad-request /unauthorized /forbidden /too-many-requests /error /server-error /maintenance | Navigate respective numeric route | /error and /server-error both /500 |
| /admin | Navigate DEFAULT_ADMIN_PATH | /admin/config/health, services/session/adminReturnTo.ts:2 |
| /admin/login | pages/admin/AdminConfig.tsx | ui-auth-page/admin-auth-shell; actual auth variants, login/TOTP/bootstrap/setup/session loading |
| /admin/new-post | AuthGuard > pages/admin/NewPost.tsx | ui-new-post-page, breadcrumb + features/admin/content/PostEditorWorkspace.tsx; ui-editor.css |
| /admin/config, /admin/config/:section, /admin/config/:section/:subtab | AuthGuard > AdminConfig > AdminDashboard.tsx:216 | WorkspaceShell ui-admin-workspace; sidebar/mobile select; dense ui-admin-* heading, panel; ui-workspaces.css |
| /admin/auth/callback | pages/admin/AdminAuthCallback.tsx:121 | ui-auth-page/ui-auth-card, loading/error |
| * | NotFound | includes unrecognized admin/dev paths |

No dev route is registered. Do not infer one from filenames or stale AGENTS route table.

## Admin completeness

AdminDashboard.tsx:40–99 defines 9 sections; :259–293 renders actual managers:
- health: health/SystemHealth; rag: rag/RAGManager; analytics: analytics/AnalyticsManager; logs: logs/LogViewer; config: ConfigManager.
- content: content/ContentManager, subtabs editor and home-cta (:27–32).
- ai: ai/AIManager, subtabs playground, models, providers, routes, monitoring, traces, prompts (:15–21).
- secrets: secrets/SecretsManager, subtabs overview, secrets, audit (:21–23).
- workers: WorkersManager, subtabs workers, secrets, resources (:342–352).
Each manager has real empty/loading/error/data and mutation dialogs; styling outer shell alone does not prove these surfaces match. Existing admin tests verify unavailable-vs-empty distinctions and stale selectors; preserve them.

## Shared and global surfaces

App PublicShell wraps every route; RouteHeader suppresses Header for admin. RouteFooter suppresses Footer for admin/Insight. GlobalAssistants suppresses visible assistants for Insight/blog/admin; blog/admin remove custom ai-memo-pad nodes. Others contain FAB or VisitedPostsMinimap and the custom memo element. Theme and language, notification panel, header search/mobile menu, modal portals, toaster, focus outlines, loading fallback and ErrorBoundary must all be included in visual coverage. Header.tsx:192 currently plain ui-header with Nodove wordmark; attachment has editorial masthead/edition.

Styles imported from index.css:1–13 are ui-tokens, layouts, home, pages, workspaces, editor, adaptive, projects, insight, comments, rich-controls, scrollbars, reading. Later legacy index.css rules and App.css can override token/application rules. Components mostly use ui-* semantic classes but retain utility classes.

## Reference intent and caveats

Attachment /home/nodove/다운로드/nodove-fieldnotes-reader-refined.html is full standalone prototype, not solely an article mockup. CSS :1–139 defines green ink/neutral paper and dark green theme, serif display + sans prose + mono captions, 1240px main width, 80/68px masthead, 760px reader, default 18px prose/1.98 leading; separate opt-in terminal; warm paper is presentation-only. :190–351 specifies home/archive/public/article/admin/auth/editor/Insight/error systems. :428 onward reader v2 supersedes part of earlier fn reader rules: shared text axis, optional media, persistent tool dialogs and readable article alongside notes.

Functions home (:589), archive (:1187), projects (:1189), about (:1190), insight (:1191), debate (:1192), admin (:1194), editor (:1195), auth (:1196), error (:590) explicitly provide broad page visual guidance. Home is editorial split title/description-search-actions; archive has ruled header/search plus restrained rows; public titles are serif, generous margins; controls modest radii, thin rules, restrained shadows; workspace uses same materials with higher density. Article must gain actual reader composition, not merely a recolor.

Caveat: prototype projects fetches live entries without invented placeholders; About avoids invented personal data; admin deliberately displays unknown metrics and links to real authenticated app; editor/debate/contact are local drafts. Those are reference/demo limitations, not instructions to replace functioning production workflows. Keep actual source services, authenticated operations and real content. Prototype article body is explicitly a design sample; do not copy sample text or embedded runtime/config into production.

## Styling mismatches needing verification

- ui-tokens.css:3–19 light currently blue/gray (#f7f8fa canvas, #2456bc accent), :45–61 dark blue-gray; must align with actual reference, including --ui-* and shadcn tokens.
- Article current TOC is right-side in BlogPost.tsx:954; reference uses left reader rail and text-axis header. Color changes cannot satisfy this.
- ui-reading.css:293–334 and :517 onward hardcoded navy/white code/tool surfaces; assess appropriate reading/terminal-specific treatment rather than global color replacement.
- AdminConfig.tsx:123/209/297 primary buttons use bg-ui-text + text-white; they can mismatch dark on-accent contrast. TOTP success semantic emerald (:435/514) and errors red (:62) should stay distinguishable.
- Portal CSS ui-comments.css:2, ui-pages.css:53 and workspace overlay styles use own radii/shadows and explicit dimensions. They do not inherit outer page layout by ancestry.
- Header uses terminal-specific window button tokens; preserve terminal contrast and opt-in behavior.

## Existing verification evidence available (not yet executed by this inventory)

frontend/e2e/site-design.spec.ts:24 runs light/dark/terminal × 320/768/1440 on /, /blog, /projects, /about, /debate, /404, /insight, checks main geometry and 44px header/footer targets. Also search/reset, pagination, insight inspector focus, memo/menu keyboard focus, debate input, subscription failure, reduced motion, terminal tools, hover contrast. It does NOT visually establish reference fidelity and does NOT cover admin or all status presets.

frontend/e2e/reading-design.spec.ts and article-diagrams.spec.ts cover reader/content; src/test/reading, pages/public/blog-post tests preserve real article/quick action behavior. Layout.test.tsx, Home*.test.tsx, Project*.test.tsx, header/search/memo tests cover shared interactions. src/test/AdminGuard.routing.test.tsx, AdminAuth.security.test.tsx, AdminConfig.test.tsx, AdminDashboard*.test.tsx, AdminSubtabs.test.tsx and manager tests cover admin contracts. scripts/ui-foundation-contracts.test.mjs and ui-remaining-pages.test.mjs are explicit source/handler gates, not visual proofs. Package scripts support type-check, lint, test:run, build, korean:scan; screenshot comparison against attachment at desktop/mobile and theme/state coverage is still needed.
