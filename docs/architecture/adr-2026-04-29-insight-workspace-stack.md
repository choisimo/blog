# ADR: Insight Workspace Stack Workflow

## 1. Architecture Decision Record (ADR) & Trade-offs

### Current vs. Target

Current `/insight` is a single page that owns graph data loading, graph layout, canvas rendering, localStorage parsing, preview UI, and navigation actions in one component. Memo, AI chat, and visited stack workflows live outside the page in the global FAB, the `ai-memo-pad` web component, `ChatWidget`, and `VisitedPostsMinimap`.

Target structure introduces an `insight-workspace` feature boundary that owns the graph selection workflow, the right-side post inspector, and an in-page stack tray. Existing memo and chat implementations remain unchanged behind adapter actions.

### Decision

- Add `frontend/src/components/features/insight-workspace/` as the new UI and domain boundary.
- Keep graph normalization and layout deterministic and pure where practical.
- Let `InsightWorkspacePage` own page-level state: loading, selected node, stack tray items, chat modal state, and action status.
- Route `/insight` through the new workspace page while leaving existing AI Memo and chat contracts intact.
- Suppress global assistant chrome on `/insight` so the page-local inspector, memo, chat, and stack workflow is the active workspace surface.
- Use adapters for legacy integrations:
  - AI Memo: open through the existing `ai-memo-pad` launcher when present.
  - AI Chat: mount the existing `ChatWidget` with selected post context.
  - Stack: use a local workspace stack persisted under a dedicated key.

### Trade-offs

Pros:

- The graph workflow gains explicit module boundaries without rewriting chat or memo systems.
- The stack tray can be tested as a page-owned state model before introducing durable backend storage.
- The UI avoids canvas hit-testing for new controls, improving keyboard accessibility.

Cons/Risks:

- Memo opening still depends on the legacy web component until it exposes a stable public event or method.
- The stack is page-local and browser-local in this first slice.
- `/insight` no longer uses the old canvas implementation, so visual behavior changes are intentional and should receive screenshot coverage.

## 2. System Decomposition & File Structure

### Proposed Tree

```text
frontend/src/components/features/insight-workspace/
  InsightWorkspacePage.tsx
  domain.ts
  types.ts
  index.ts
```

### Responsibilities

- `types.ts`: public data contracts for graph nodes, edges, post keys, inspector actions, and stack items.
- `domain.ts`: pure normalization and deterministic graph construction from posts, chat sessions, curiosity events, and AI Memo events.
- `InsightWorkspacePage.tsx`: React orchestration, layout, interaction handlers, inspector, stack tray, and ChatWidget adapter.
- `index.ts`: feature export boundary.

## 3. Public Interfaces & Contracts

### Types / Signatures

```ts
export type InsightPostKey = `${string}/${string}`;

export type InsightNodeType =
  | "post"
  | "chat"
  | "memo"
  | "thought"
  | "tag"
  | "search";

export type InsightWorkspaceItem = {
  id: string;
  kind: "post" | "memo" | "chat" | "thought";
  postKey?: InsightPostKey;
  title: string;
  subtitle?: string;
  createdAt: number;
};

export function buildInsightGraph(input: BuildInsightGraphInput): InsightGraph;
```

### Interface Contracts

- `InsightPostKey` must be `year/slug`; slug-only matching is not allowed for new workspace state.
- `buildInsightGraph` must tolerate malformed localStorage payloads by dropping invalid entries.
- UI actions must fail visibly in the inspector status region, not silently.
- Memo and chat adapters must not mutate graph domain state directly.

## 4. Dependency Direction Rules

Allowed:

- `InsightWorkspacePage -> domain/types`
- `InsightWorkspacePage -> existing services/components`
- `domain -> types`

Forbidden:

- `domain -> React`
- `domain -> localStorage/window/document`
- `domain -> ChatWidget`
- `PostInspector/StackTray UI -> ai-memo shadow DOM`

Legacy integrations must stay inside `InsightWorkspacePage` adapter callbacks until a dedicated shared port exists.

## 5. Migration & Guardrails

### Transition Plan

1. Fix the existing selected-block type-check blocker.
2. Add the `insight-workspace` boundary and route `/insight` through it.
3. Keep existing FAB and `VisitedPostsMinimap` behavior unchanged on non-Insight routes.
4. Use page-local stack persistence first, then evaluate whether it should merge with `visited.posts`.
5. Add screenshot or interaction tests after the UI stabilizes.

### Rollback Points

- Revert `frontend/src/pages/public/Insight.tsx` to the old component if the new workspace causes routing regressions.
- Remove `frontend/src/components/features/insight-workspace/` without affecting chat, memo, or FAB code.
- Clear `insight.workspace.stack.v1` from localStorage if stack shape changes.

## 6. Handoff to Implementer

Priority backlog:

1. Fix `selectedBlockSerializer.ts` optional source access.
2. Create `insight-workspace` types and graph builder.
3. Build a desktop right-side inspector and mobile bottom inspector with stable dimensions.
4. Add an in-page stack tray with add/remove/select actions.
5. Wire post actions to navigate, open memo, and open chat.
6. Run `npm run type-check` and targeted tests.

Constraints:

1. Do not import `ChatWidget` or browser APIs from graph domain files.
2. Do not rely on slug-only post identity in new workspace contracts.
3. Do not animate layout-affecting properties; use transform and opacity only for motion.
