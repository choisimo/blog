# ADR: Memo Editor Auto Code Mode

## 1. Architecture Decision Record (ADR) & Trade-offs

### Current vs. Target

- Current: `frontend/public/ai-memo/ai-memo.js` owns the floating memo web component, Markdown preview, cloud sync, versioning, and proposal flows in one Shadow DOM surface. `frontend/src/components/features/sentio/CodeIDE.tsx` owns a separate CodeMirror editor and directly calls `/api/v1/execute`.
- Current limitation: code execution and memo editing are coupled to separate UI surfaces, so a memo containing code cannot get a lightweight run/copy console without either duplicating the Sentio IDE or turning the memo pad into a full IDE.
- Target: keep the memo editor Markdown-first, detect runnable code intent inside memo content, and expose an inline code-mode strip with copy/run/result controls. Keep multi-file IDE behavior as a separate future workspace concern.

### Decision

- Ship Version A as the default behavior: inline code mode appears only when memo content has a fenced code block or high-confidence code-like content.
- Include the smallest Version B slice: a reserved execution console inside the same memo panel, bound to the currently detected code revision.
- Defer Version C to a separate workspace/IDE feature. The memo feature must not own file trees, multi-tab state, or project-level run semantics.
- Expose `features.codeExecutionEnabled` through the public runtime config so UI can distinguish "copy/edit code" from "run code".

### Trade-offs

- Pros: preserves the memo-writing flow, has low layout risk, avoids cross-feature imports from `features/sentio`, and can be rolled back with a flag.
- Cons/Risks: heuristic code detection can be wrong; execution still depends on the admin-gated backend route; multi-file workflows are intentionally out of scope.

## 2. System Decomposition & File Structure

### Proposed Tree

```text
frontend/public/ai-memo/
  ai-memo.js        # Shadow DOM memo feature, code intent detection, inline run console
  ai-memo.css       # Shadow DOM code-mode styles and responsive/reduced-motion rules

shared/src/contracts/
  public-runtime-config.js
  public-runtime-config.d.ts

frontend/src/stores/runtime/
  useFeatureFlagsStore.ts

backend/src/config/
  env.js
  index.js

workers/api-gateway/src/
  index.ts
  types.ts
```

### Responsibilities

- `ai-memo.js`: owns memo-local code detection, run request creation, stale result protection, and Shadow DOM event wiring.
- `ai-memo.css`: owns stable dimensions, state visuals, mobile wrapping, and reduced-motion fallbacks for the code-mode panel.
- `public-runtime-config.*`: defines the cross-runtime feature contract consumed by React and the standalone memo web component.
- `useFeatureFlagsStore.ts`: merges the public flag into the frontend runtime store with a safe default.
- Backend/worker config files: publish the flag without changing backend route authorization.

## 3. Public Interfaces & Contracts

### Types / Endpoints / Signatures

- Public runtime feature contract:
  - `features.codeExecutionEnabled: boolean`
- Existing backend endpoint:
  - `POST /api/v1/execute`
  - Request: `{ language: string, version?: string, files: [{ content: string }], run_timeout?: number }`
  - Response: `{ ok: true, data: { run: { stdout?: string, stderr?: string, code?: number } } }` or `{ ok: false, error: string | { message?: string } }`

### Interface Contracts

- Memo Markdown text remains the source of truth.
- The code-mode panel must not mutate memo content except through existing textarea input flows.
- Run results are displayed only if they match the latest detected code revision.
- Execution is never automatic; it only starts from a user click.
- Failure propagation stays local to the panel and status line; failed execution must not block memo persistence.

## 4. Dependency Direction Rules

- Allowed: `ai-memo.js -> public runtime config on window`, `ai-memo.js -> /api/v1/execute`.
- Allowed: backend/worker public config builders -> shared public runtime contract.
- Forbidden: `ai-memo.js -> React features`, `features/memo -> features/sentio`, `public-runtime-config -> UI code`.
- The execute route remains backend-owned and admin-gated; exposing a flag is not permission bypass.

## 5. Migration & Guardrails

### Transition Plan

1. Publish `features.codeExecutionEnabled` with default `false`.
2. Add inline detection and copy controls regardless of execution availability.
3. Enable run controls only when the public flag is true.
4. Keep Version C out of memo until a separate workspace route owns file/project state.

### Rollback Points

- Turn off `FEATURE_CODE_EXECUTION_ENABLED` to disable run controls while keeping copy/edit mode.
- Revert only the `ai-memo` asset changes if the UI causes regressions; memo content storage format is unchanged.
- Because no memo schema changes are introduced, rollback does not require data migration.

## 6. Handoff to Implementer

1. Update runtime config contracts to publish `codeExecutionEnabled`.
2. Add memo-local code detection and language mapping to `ai-memo.js`.
3. Add code-mode Shadow DOM markup and event wiring.
4. Add responsive, reduced-motion CSS for code-mode controls and console.
5. Verify frontend type-check and inspect the public asset for syntax consistency.

Constraints:

- Do not auto-run code.
- Do not change the memo storage format.
- Do not import React modules into the standalone `ai-memo` public asset.
