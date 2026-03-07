# AGENTS.md — frontend/

## OVERVIEW

React 18 SPA served from GitHub Pages. Vite build, Tailwind CSS, shadcn/ui (Radix primitives), Zustand, TanStack Query, react-router-dom v6.

## STRUCTURE

```
frontend/
├── config/         # All tool configs: vite, eslint, prettier, tailwind, tsconfig
├── public/
│   ├── posts/      # Markdown blog posts (year/slug.md)
│   ├── images/     # Post images (auto-organized by scripts/organize-images.sh)
│   └── project-data/  # JSON files for Projects page
├── scripts/        # Build-time Node scripts (manifest gen, SEO, korean-normalize)
├── src/
│   ├── App.tsx     # Router root + providers
│   ├── main.tsx    # Entry point
│   ├── components/
│   │   ├── ui/         # shadcn components (auto-generated, do NOT hand-edit)
│   │   ├── features/   # Domain components (blog, admin, chat, debate, memo, sentio…)
│   │   ├── organisms/  # Composed layouts (Header, Footer)
│   │   ├── molecules/  # Mid-level reusable
│   │   └── atoms/      # Primitives
│   ├── pages/      # Route-level components
│   ├── stores/     # Zustand stores
│   ├── services/   # API client functions (one file per domain)
│   ├── hooks/      # Custom hooks
│   ├── types/      # Shared TypeScript types
│   ├── contexts/   # React contexts (ThemeContext, LanguageContext)
│   ├── lib/        # Non-React utilities
│   └── utils/      # Misc helpers (apiBase, seo, i18n)
└── verification-screenshots/  # Playwright artifacts — do not delete
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add/edit a page | `src/pages/` + route in `src/App.tsx` |
| Add UI primitive | `src/components/ui/` (via `npx shadcn@latest add`) |
| Add feature component | `src/components/features/<domain>/` |
| Add API call | `src/services/<domain>.ts` |
| Add global state | `src/stores/use<Name>Store.ts` (Zustand + `create`) |
| Add custom hook | `src/hooks/use<Name>.ts` |
| Add TypeScript types | `src/types/` |
| Add/edit blog post | `public/posts/<year>/<slug>.md` |
| Add project entry | `public/project-data/*.json` |
| Environment variables | `.gh_env.example` (root) — prefixed `VITE_` |
| Feature flags | `src/stores/useFeatureFlagsStore.ts` |
| Build config | `config/vite.config.ts` |
| Lint / format config | `config/eslint.config.js`, `config/prettier.config.js` |

## PAGES & ROUTES

| Route | Component |
|-------|-----------|
| `/` | `Index.tsx` |
| `/blog` | `Blog.tsx` |
| `/blog/:year/:slug` | `BlogPost.tsx` |
| `/projects` | `Projects.tsx` |
| `/about` | `About.tsx` |
| `/insight` | `Insight.tsx` |
| `/admin/new-post` | `NewPost.tsx` |
| `/admin/config` | `AdminConfig.tsx` |

## CONVENTIONS

- **Config files**: All in `frontend/config/` — pass `--config config/X.config.ts` to tools
- **Path alias**: `@/` → `src/` (configured in tsconfig + vite)
- **Zustand pattern**: `create<State>()` with `persist` middleware for auth; `immer` for complex state
- **API base URL**: Always use `getApiBaseUrl()` from `src/utils/apiBase.ts` — never hardcode
- **Feature flags**: Check `useFeatureFlagsStore` before rendering optional features
- **Korean normalization**: Run `npm run korean:scan` before committing Korean text

## ANTI-PATTERNS

- Do NOT edit `src/components/ui/` manually — managed by shadcn CLI
- Do NOT edit `public/posts-manifest.json`, `public/projects-manifest.json`, `public/sitemap.xml`, `public/rss.xml`, `public/robots.txt` — CI-generated
- Do NOT hardcode `VITE_API_BASE_URL` — read from env or `getApiBaseUrl()`
- Do NOT add new pages without a route entry in `App.tsx`
- Do NOT use `as any` or `@ts-ignore`

## COMMANDS

```bash
npm run dev           # Vite dev server (auto-generates manifests first via predev)
npm run build         # Full prod build (prebuild: manifests + SEO; postbuild: static HTML)
npm run type-check    # tsc --noEmit
npm run lint          # ESLint, 0 warnings enforced
npm run format        # Prettier
npm run test:run      # Vitest (no watch)
npm run korean:scan   # Check Korean text normalization
npm run generate-manifests  # Regenerate posts-manifest.json manually
```

## NOTES

- `prebuild` / `postbuild` hooks run automatically — scripts generate manifests, SEO files, and static HTML for prerendering
- TanStack Query (`QueryClient`) wraps the app for server-state caching
- `ThemeProvider` and `LanguageProvider` wrap the router
- `FloatingActionBar` (FAB) is feature-flagged via `VITE_FEATURE_FAB` env + `aiMemo.fab.enabled` localStorage key
