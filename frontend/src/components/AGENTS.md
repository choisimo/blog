# AGENTS.md — frontend/src/components/

## OVERVIEW

Atomic design hierarchy. `ui/` is shadcn-managed. `features/` contains all domain-specific React components.

## STRUCTURE

```
components/
├── ui/             # shadcn/ui primitives — DO NOT hand-edit
├── features/
│   ├── admin/      # Admin panel (ai/, analytics/, health/, rag/, secrets/)
│   ├── blog/       # Blog post UI (CommentSection, PostCard, etc.)
│   ├── chat/       # Chat widget + hooks
│   ├── console/    # Console/terminal UI
│   ├── debate/     # Debate arena feature
│   ├── memo/       # Floating memo / FAB
│   ├── navigation/ # VisitedPostsMinimap, nav helpers
│   ├── projects/   # Projects listing
│   ├── search/     # Search UI
│   ├── sentio/     # Sentio (quiz/debate room) feature
│   └── terminal/   # Web terminal component
├── organisms/      # Header, Footer (import from `@/components/organisms`)
├── molecules/      # Mid-level reusables
├── atoms/          # Single-purpose primitives
└── common/         # ErrorBoundary and cross-cutting components
```

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add shadcn component | `npx shadcn@latest add <name>` → drops into `ui/` |
| Add admin feature | `features/admin/<subdomain>/` |
| Add/edit blog UI | `features/blog/` |
| Add layout component | `organisms/` |
| Edit global error boundary | `common/ErrorBoundary` |
| Add chat UI | `features/chat/widget/` |

## CONVENTIONS

- **Import path**: `@/components/<category>/<component>` — never relative `../../`
- **Feature folders**: one folder per product domain, self-contained (component + local hooks)
- **Organisms barrel**: `organisms/index.ts` exports `Header` and `Footer`
- **Admin sub-features** each have their own folder under `features/admin/`

## ANTI-PATTERNS

- Do NOT edit files in `ui/` — managed by shadcn CLI (`npx shadcn@latest add`)
- Do NOT place page-level logic in components — pages live in `src/pages/`
- Do NOT create cross-feature imports between `features/` subdirs — extract to `molecules/` or `atoms/` if shared
