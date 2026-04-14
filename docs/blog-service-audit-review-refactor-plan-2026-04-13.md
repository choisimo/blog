# 블로그 서비스 감사 보고서 검토 및 리팩토링 계획안

- 기준 보고서: `/home/nodove/다운로드/blog_service_audit_report.pdf`
- 검토 일시: `2026-04-13`
- 기준 코드: `/home/nodove/workspace/blog` 현재 워크트리

## 0. 결론

이번 검토 기준으로 릴리즈 판정은 보고서와 동일하게 `NO-GO`가 맞습니다. 근거는 두 가지가 결정적입니다.

1. `frontend` production build가 `frontend/src/bootstrap.ts:1-4`의 top-level await 때문에 실제로 실패합니다.
2. `frontend` type-check가 실제로 `98건`의 TypeScript 오류를 출력합니다.

다만 보고서의 "worker-owned" 표현은 현재 구현 상태를 완전히 설명하지는 못합니다. `shared` 계약과 문서는 ownership을 분리하고 있지만, 실제 런타임은 `worker-native + worker->backend proxy + backend->worker reverse proxy`가 섞인 hybrid 상태입니다. 따라서 이번 리팩토링의 1차 목표는 기능 추가가 아니라 다음 네 가지입니다.

1. 프런트엔드 릴리즈 게이트 복구
2. shared contract 타입 계약 복구
3. route ownership 단일화
4. 배포 단위와 상태 저장 전략 분리

추가로 `2026-04-13`에 `ssh blog`로 원격 배포 서버를 직접 확인한 결과, 사용자 체감 장애가 있는 AI artifact 계열 기능도 부분적으로 `NO-GO` 판단을 강화합니다. 카드 생성은 요청 수락 후 계속 `warming`에 머물고, uncached 번역은 `202 pending`에서 수렴하지 않았습니다. 반면 cached 번역 조회와 backend AI generate 자체는 살아 있으므로, 장애 지점은 "모델 호출 전"이 아니라 "worker-native artifact 저장/flush/조회 경계"에 더 가깝습니다.

## 1. 감사 보고서 검토 결과

| 항목 | 보고서 주장 | 실제 검증 결과 | 판단 |
| --- | --- | --- | --- |
| 프런트엔드 build | `bootstrap.ts` top-level await 때문에 build 실패 | `npm run build`에서 동일 오류 재현 | 보고서와 일치 |
| 프런트엔드 type-check | `98건` 진단 | `npm run type-check --silent 2>&1 | rg -c "error TS"` 결과 `98` | 보고서와 일치 |
| chat WebSocket dead path | runtime config는 `supportsChatWebSocket: false`, worker `/ws`는 `501` | `frontend/scripts/generate-runtime-config.js`, `workers/api-gateway/src/index.ts`, `workers/api-gateway/src/routes/chat.ts`에서 확인 | 보고서와 일치 |
| route ownership 중복 | worker-owned 경계가 backend와 worker에 동시에 존재 | `shared/src/contracts/service-boundaries.js`, `backend/src/routes/registry.js`, `workers/api-gateway/src/routes/registry.ts` 교차 확인 | 보고서보다 더 심각함 |
| terminal capability 노출 | UI/hook 쪽 방어는 있으나 service 레벨 최종 보증이 약함 | `frontend/src/services/realtime/terminal.ts`가 feature flag를 직접 보지 않음 | 보고서와 일치 |
| dynamic AI config degraded fallback | Worker 미연결 시 env fallback으로 후퇴 | `backend/src/services/ai/dynamic-config.service.js`, `backend` 테스트 로그에서 확인 | 보고서와 일치 |
| route/contract governance | 계약 체크는 통과 | `npm run contracts:check`, `npm run routes:check`, `npm run routes:check:orphans` 통과 | 보고서와 일치 |
| backend test 상태 | backend test는 대체로 green | `npm test` 결과 11 pass, 1 skip(`REDIS_URL` 미설정) | 보고서와 대체로 일치 |

보강이 필요한 해석도 있습니다.

- `terminalEnabled`는 shared runtime contract에서 URL과 flag를 함께 반영해 계산되지만, `terminalGatewayUrl` 자체는 그대로 노출되므로 service 레이어가 이를 다시 검증하지 않으면 우회 호출이 가능합니다.
- `chat`은 "worker-owned"로 문서화돼 있지만 실제 구현은 절반은 worker native, 절반은 backend proxy, 일부는 backend에서 다시 worker로 되돌아가는 구조입니다. 즉, 현재 문제는 단순 중복이 아니라 "prefix 단위 ownership 모델이 실제 API 표면을 제대로 표현하지 못하는 것"입니다.

### 1.1 원격 배포 서버(`ssh blog`) 추가 진단

원격 배포 전용 서버에서 `2026-04-13` 기준으로 직접 재현한 결과는 다음과 같습니다.

| 항목 | 실제 재현 결과 | 해석 |
| --- | --- | --- |
| 카드 생성 진입 | `POST /api/v1/chat/session/test/lens-feed`에 유효 JSON 본문을 보내면 `200`, `Retry-After: 3`, `warming: true` 응답 | 라우트 자체는 살아 있고 무인증 public 진입도 가능합니다. "즉시 401" 문제는 현재 배포 기준 핵심 원인이 아닙니다. |
| 카드 생성 수렴 여부 | 같은 payload로 약 30초 이상 뒤 재조회해도 계속 `items: []`, `warming: true` | 카드 생성 장애는 "요청 거부"가 아니라 "artifact snapshot이 ready 상태로 보이지 않음"에 가깝습니다. |
| backend AI 호출 | 원격 `api` pod 로그에 `Blog-Workers/1.0 -> POST /api/v1/ai/generate -> Async generation completed`가 반복 기록 | 모델 호출 자체와 backend AI queue는 살아 있습니다. 장애 지점은 model completion 이후입니다. |
| backend queue 상태 | `GET /api/v1/ai/queue-stats` 결과 `enabled: true`, `asyncMode: true`, `queueLength: 0`, `dlqLength: 0`, `consumerGroups[0].consumers: 1` | Redis queue 자체가 막혀 있는 상황은 아닙니다. |
| cached 번역 조회 | `GET /api/v1/public/posts/.../translations/en`이 `200`으로 실제 번역 payload 반환, `stale: true`, `warming: true` 포함 | 번역 기능이 완전히 죽은 것은 아닙니다. cache hit/stale serve는 동작합니다. |
| uncached 번역 조회 | `GET /api/v1/public/posts/.../translations/ko`가 `202`, `Retry-After: 15`를 반환하고 약 40초 뒤에도 계속 `202` | uncached 번역은 사용자 입장에서 "계속 준비 중"으로 보일 수 있습니다. 카드 생성과 유사한 비수렴 증상입니다. |
| 번역 언어 계약 | `GET /api/v1/public/posts/.../translations/ja`는 `400 Unsupported target language: ja` | `ja`는 장애가 아니라 미지원 계약입니다. 현재 worker translation contract는 `ko/en`만 허용합니다. |
| 보호된 번역 생성 엔드포인트 | `POST /api/v1/internal/posts/.../translations/.../generate`와 legacy `POST /api/v1/translate`는 `Authorization` 없으면 `401 Missing Authorization header` | "번역 고장" 제보에는 무인증 generate 호출과 public cache polling 문제를 분리해서 봐야 합니다. |

여기서 더 중요한 사실은 상태 저장 위치입니다.

1. 원격 `api` pod의 `/app/.data/blog.db`에는 `post_translations_cache`, `translation_jobs`, `domain_outbox`, `ai_artifact_versions`, `ai_artifact_pages`가 모두 비어 있었습니다.
2. 그런데 같은 시점에 public 번역 cache endpoint는 실제 번역 payload를 반환했습니다.
3. 따라서 카드/번역 artifact의 실제 source of truth는 현재 k3s backend SQLite가 아니라 Cloudflare Worker 쪽 저장소(`env.DB`로 연결된 D1 계열)입니다.

이 사실은 원인 판단을 크게 바꿉니다.

1. 카드 생성 장애는 k3s pod 안의 backend worker process 문제가 아니라 worker-native artifact pipeline 문제일 가능성이 높습니다.
2. 번역 장애도 backend auth/env 설정 문제보다는 worker-side outbox/idempotency/flush cadence 문제일 가능성이 더 큽니다.
3. 현재 운영자는 `ssh blog`만으로 worker artifact state를 직접 볼 수 없고, `admin` JWT 없이는 `/api/v1/admin/outbox/*` recovery surface도 호출하기 어렵습니다. 즉 장애 자체뿐 아니라 운영 가시성도 부족합니다.

원격 증상과 코드 경로를 합치면 가장 가능성이 높은 실패 지점은 세 군데입니다.

1. `workers/api-gateway/src/lib/feed-normalizers.ts:387-406` 기준 첫 페이지 normalization 실패로 ready snapshot 저장이 거부되는 경우
2. `workers/api-gateway/src/lib/ai-artifact-outbox.ts:574-640` 기준 outbox flush가 cron cadence와 idempotency 재사용에 묶여 stale pending 상태가 길어지는 경우
3. worker D1 쪽에서는 상태가 존재하지만 운영 surface가 부족해 stuck/dead-letter를 식별하지 못하는 경우

## 2. 현재 구조 진단

### 2.1 Frontend boot path

현재 부트스트랩은 다음과 같습니다.

```ts
import { preloadRuntimeConfig } from './lib/runtime/preloadRuntimeConfig';

await preloadRuntimeConfig();
await import('./main.tsx');
```

이 구조는 다음 문제를 동시에 가집니다.

1. build target이 `es2020` 계열일 때 top-level await가 즉시 실패합니다.
2. runtime config preload가 느릴 때 화면 진입이 통째로 지연됩니다.
3. `main.tsx`가 side-effect import로 직접 mount하므로 bootstrap 책임과 mount 책임이 분리되어 있지 않습니다.

### 2.2 Shared contract와 실제 route 책임의 불일치

`shared/src/contracts/service-boundaries.js`는 `/api/v1/chat`, `/api/v1/notifications`, `/api/v1/rag`, `/api/v1/images` 등을 worker-owned로 선언합니다. 하지만 실제 구현은 다음과 같습니다.

1. `workers/api-gateway/src/routes/chat.ts`는 `/session`, `/message`, `/task`, `/aggregate`, `/live/*` 대부분을 backend로 proxy합니다.
2. 반대로 `backend/src/routes/chat.js`는 `/lens-feed`, `/thought-feed`를 다시 worker로 proxy합니다.
3. `workers/api-gateway/src/routes/notifications.ts`는 notification read/stream 경로를 backend로 proxy합니다.
4. `backend/src/routes/registry.js`는 worker-owned로 선언된 `ai`, `analytics`, `chat`, `translate`, `memos`, `images`, `auth`, `rag`, `memories`, `search`, `debate`, `notifications`까지 여전히 mount합니다.

즉 현재는 "worker-owned prefix"가 아니라 "같은 prefix 안에 worker-native와 backend-native가 섞인 hybrid contract"입니다.

### 2.3 Terminal capability guard의 계층 누락

현재 hook 계층은 `useFeatureEnabled("terminalEnabled")`를 사용해 방어합니다. 그러나 실제 연결을 만드는 `frontend/src/services/realtime/terminal.ts`는 `terminalGatewayUrl`과 auth token만 보면 연결을 시도합니다.

즉 현재 구조는 다음 전제를 암묵적으로 요구합니다.

1. 모든 호출자가 반드시 hook 또는 UI 버튼에서 먼저 flag를 확인해야 한다.
2. service를 직접 호출하는 다른 화면/테스트/미래 코드가 이 규칙을 깨지 않아야 한다.

이 전제는 안전하지 않습니다. capability enforcement는 service 레벨에서 최종 보증해야 합니다.

### 2.4 배포 토폴로지 결합도

`k3s/api.yaml` 기준 현재 `api` deployment는 다음을 한 pod에 묶고 있습니다.

1. `replicas: 1`
2. `strategy.type: Recreate`
3. `PersistentVolumeClaim api-sqlite`
4. `sync-repo` initContainer의 git clone
5. `ai-worker` sidecar

여기에 optional terminal은 `k3s/optional/terminal/terminal-optional.yaml`에서 privileged DinD까지 사용합니다. 지금 구조는 "돌아가게 만들기"에는 유리하지만, scale unit과 failure domain 분리에는 불리합니다.

## 3. 아키텍처 결정(ADR)

### Context

현재 구조의 핵심 문제는 기능 자체보다 경계 모델이 실제 코드를 못 따라간다는 점입니다.

1. 프런트엔드는 `release gate`가 깨져 있습니다.
2. shared contract는 존재하지만 prefix 단위 ownership 정의가 hybrid route를 제대로 표현하지 못합니다.
3. terminal/chat 같은 capability는 문서와 일부 UI에서는 차단되지만 service 레이어까지 일관되게 내려오지 않습니다.
4. 배포 단위가 API, worker process, repo sync, SQLite state를 한 덩어리로 묶고 있습니다.

### Decision

다음 목표 구조를 채택합니다.

1. Frontend bootstrap은 `async function bootstrap()` + `timeout guarded preload`로 바꿉니다.
2. Chat transport는 실제 edge WebSocket 구현 전까지 `SSE-only`로 단순화합니다.
3. Route ownership은 `prefix-based`에서 `route-level` 또는 최소한 `sub-boundary based`로 세분화합니다.
4. Proxy-heavy worker routes는 공통 backend proxy helper로 정리합니다.
5. Terminal capability는 service 레이어가 최종 보증합니다.
6. `api`와 `ai-worker`는 배포 단위를 분리하고, SQLite 외부화 이전까지는 API rolling update를 보류합니다.

### Alternatives

대안 1. 현재 prefix-based contract를 유지하고 문서만 보강

- 기각 이유: 현재 chat처럼 한 prefix 안에서 ownership이 섞인 경우를 표현하지 못합니다.

대안 2. WebSocket을 즉시 완성해서 WS/SSE dual transport 유지

- 기각 이유: 현재 dead path 제거가 우선입니다. 미구현 transport를 유지하는 것은 복잡도만 늘립니다.

대안 3. API와 AI worker를 계속 sidecar로 유지

- 기각 이유: 배포 단위와 장애 단위가 분리되지 않아 scale-out과 fault isolation이 막힙니다.

### Consequences

장점:

1. 릴리즈 게이트를 빠르게 복구할 수 있습니다.
2. route ownership drift를 코드와 계약 양쪽에서 동시에 줄일 수 있습니다.
3. capability bug를 UI 실수로부터 보호할 수 있습니다.
4. infra 변경을 API code refactor와 분리해서 진행할 수 있습니다.

단점:

1. shared contract, route governance script, worker/backend registry를 함께 바꿔야 합니다.
2. 기존 prefix 문서와 일부 운영 습관이 깨질 수 있습니다.
3. 단계적 공존 기간 동안 compatibility alias 또는 feature flag가 필요합니다.

## 4. 상세 리팩토링 계획

### Patch 1. Frontend bootstrap을 build-safe + timeout-safe로 수정

문제:

- `frontend/src/bootstrap.ts:1-4`가 build를 깨뜨립니다.
- preload가 느리면 첫 렌더가 과도하게 지연됩니다.

이전 코드:

```ts
// frontend/src/bootstrap.ts
import { preloadRuntimeConfig } from './lib/runtime/preloadRuntimeConfig';

await preloadRuntimeConfig();
await import('./main.tsx');
```

이후 코드(제안):

```ts
// frontend/src/bootstrap.ts
import { preloadRuntimeConfig } from './lib/runtime/preloadRuntimeConfig';

const BOOT_TIMEOUT_MS = 1500;

async function bootstrap() {
  await Promise.race([
    preloadRuntimeConfig(),
    new Promise((resolve) => setTimeout(resolve, BOOT_TIMEOUT_MS)),
  ]);

  const { mountApp } = await import('./main.tsx');
  mountApp();
}

void bootstrap().catch(async (error) => {
  console.error('[bootstrap] preload failed, continuing with defaults', error);
  const { mountApp } = await import('./main.tsx');
  mountApp();
});
```

```ts
// frontend/src/main.tsx
import './polyfills';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

let mounted = false;

export function mountApp() {
  if (mounted) return;
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.error('[main] #root element not found');
    return;
  }
  mounted = true;
  createRoot(rootEl).render(<App />);
}
```

대상 파일:

- `frontend/src/bootstrap.ts`
- `frontend/src/main.tsx`
- `frontend/src/test/runtimeConfig.test.ts`
- `frontend/config/vite.config.ts` 확인만 수행, target 상향은 하지 않음

완료 조건:

1. `npm --prefix frontend run build` green
2. runtime config preload 실패 시에도 앱이 mount됨
3. duplicate mount가 발생하지 않음

롤백:

- bootstrap만 이전 방식으로 되돌리면 즉시 복구 가능

### Patch 2. Shared contract 타입 선언을 복구해 type-check 붕괴를 줄임

문제:

- `@blog/shared/contracts/auth`
- `@blog/shared/contracts/notifications`
- `@blog/shared/contracts/translation`

이 세 모듈은 JS export는 있지만 대응 `.d.ts`가 없어 frontend strict TS에서 `TS7016`을 발생시킵니다.

이전 코드:

```json
// shared/package.json
{
  "exports": {
    "./contracts/translation": "./src/contracts/translation.js",
    "./contracts/notifications": "./src/contracts/notifications.js",
    "./contracts/auth": "./src/contracts/auth.js"
  }
}
```

이후 코드(제안):

```json
// shared/package.json
{
  "exports": {
    "./contracts/translation": {
      "types": "./src/contracts/translation.d.ts",
      "default": "./src/contracts/translation.js"
    },
    "./contracts/notifications": {
      "types": "./src/contracts/notifications.d.ts",
      "default": "./src/contracts/notifications.js"
    },
    "./contracts/auth": {
      "types": "./src/contracts/auth.d.ts",
      "default": "./src/contracts/auth.js"
    }
  }
}
```

```ts
// shared/src/contracts/notifications.d.ts
export type NotificationType =
  | 'ai_task_complete'
  | 'ai_task_error'
  | 'rag_complete'
  | 'chat_task_complete'
  | 'agent_complete'
  | 'system'
  | 'info'
  | 'error'
  | 'success';

export interface NotificationInboxItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  sourceId?: string | null;
  createdAt: string;
  readAt?: string | null;
}
```

추가 정리 묶음:

1. `ErrorBoundary` override modifier 추가
2. `BlogPost.language` 필수화에 맞춘 fixture 갱신
3. `uiStrings`의 overly-narrow literal type 완화
4. `Insight.tsx` union narrowing 정리
5. `WorkersManager.tsx` nullability 정리
6. `test`에서 `vi`, `afterAll`, stale mock 타입 정리

대상 파일:

- `shared/package.json`
- `shared/src/contracts/auth.d.ts`
- `shared/src/contracts/notifications.d.ts`
- `shared/src/contracts/translation.d.ts`
- `frontend/src/**` type error cluster 파일

완료 조건:

1. `npm --prefix frontend run type-check` green
2. shared contract import에 대한 `TS7016` 제거
3. fixture와 실제 domain model drift 제거

롤백:

- `.d.ts` 추가는 additive change라 롤백 비용이 낮음

### Patch 3. Chat transport를 SSE-only로 단순화하고 dead WS path 제거

문제:

1. runtime config는 WS 미지원으로 고정되어 있습니다.
2. worker `/api/v1/chat/ws`는 `501`입니다.
3. frontend는 여전히 WS 브랜치를 유지합니다.

이전 코드:

```ts
// frontend/src/services/chat/api.ts
if (shouldUseChatWebSocket()) {
  let gotEvent = false;
  try {
    for await (const event of streamChatEventsWebSocket(...)) {
      gotEvent = true;
      yield event;
    }
    return;
  } catch (err) {
    if (input.signal?.aborted) throw err;
    if (gotEvent) throw err;
    console.warn("[Chat] WebSocket failed, falling back to SSE:", err);
  }
}
```

```ts
// workers/api-gateway/src/routes/chat.ts
chat.all('/ws', async (c) => {
  return error(c, 'Chat WebSocket is not enabled on the edge in this environment', 501, 'CHAT_WS_DISABLED');
});
```

이후 코드(제안):

```ts
// frontend/src/services/chat/api.ts
export async function* streamChatEvents(
  input: StreamChatInput,
): AsyncGenerator<ChatStreamEvent, void, void> {
  const sessionID = await ensureSession();
  const { page, parts, enableRag } = buildStreamPayload(input);

  const url = buildChatUrl('/message', sessionID);
  const headers = buildChatHeaders('stream');

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      parts,
      context: { page },
      enableRag,
    }),
    signal: input.signal,
  });

  // SSE/NDJSON parsing only
}
```

```ts
// workers/api-gateway/src/routes/chat.ts
// Remove /ws route advertisement until edge WebSocket is implemented end-to-end.
```

추가 설계 결정:

1. `buildChatWebSocketUrl`
2. `shouldUseChatWebSocket`
3. `supportsChatWebSocket`

이 셋은 WS를 실제 배포하기 전까지 public surface에서 제거하거나 deprecated 처리합니다.

대상 파일:

- `frontend/src/services/chat/api.ts`
- `frontend/src/services/chat/config.ts`
- `frontend/src/test/chatConfig.test.ts`
- `workers/api-gateway/src/routes/chat.ts`
- `frontend/scripts/generate-runtime-config.js`
- `workers/api-gateway/src/index.ts`

완료 조건:

1. dead WS branch 제거
2. runtime config와 frontend transport가 동일한 의미를 가짐
3. chat stream 관련 integration test가 SSE 기준으로만 green

롤백:

- SSE path는 이미 운영 경로이므로 rollback risk 낮음

### Patch 4. Prefix ownership을 route-level ownership으로 바꾸고 reverse proxy loop 제거

문제:

- 현재 `chat` 한 prefix 안에 backend-owned와 worker-owned 동작이 공존합니다.
- backend는 일부 chat feed를 worker로 proxy하고, worker는 chat session/message를 backend로 proxy합니다.
- 이 구조는 governance 문서상 "worker-owned"라도 실제 운영 책임이 분리되지 않음을 의미합니다.

이전 코드:

```ts
// shared/src/contracts/service-boundaries.js
{ id: 'chat', prefix: '/api/v1/chat', owner: ROUTE_OWNERS.WORKER, description: 'Chat streaming edge gateway' }
```

```js
// backend/src/routes/chat.js
router.post("/session/:sessionId/lens-feed", async (req, res) => {
  return await proxyChatFeedToWorker(
    req,
    res,
    "/api/v1/chat/session/" + encodeURIComponent(sessionId) + "/lens-feed",
  );
});
```

```ts
// workers/api-gateway/src/routes/chat.ts
chat.post('/session/:sessionId/message', async (c) => {
  return proxyRequest(c, `/session/${sessionId}/message`, {
    sanitizeClientModel: true,
  });
});
```

이후 코드(제안):

```ts
// shared/src/contracts/service-boundaries.ts (route-level)
export const ROUTE_BOUNDARIES = [
  {
    id: 'chat.message',
    method: 'POST',
    path: '/api/v1/chat/session/:sessionId/message',
    owner: ROUTE_OWNERS.BACKEND,
  },
  {
    id: 'chat.task',
    method: 'POST',
    path: '/api/v1/chat/session/:sessionId/task',
    owner: ROUTE_OWNERS.BACKEND,
  },
  {
    id: 'chat.feed.lens',
    method: 'POST',
    path: '/api/v1/chat/session/:sessionId/lens-feed',
    owner: ROUTE_OWNERS.WORKER,
  },
  {
    id: 'chat.feed.thought',
    method: 'POST',
    path: '/api/v1/chat/session/:sessionId/thought-feed',
    owner: ROUTE_OWNERS.WORKER,
  },
];
```

```ts
// workers/api-gateway/src/lib/backend-proxy.ts
export function createBackendProxyRoute(options: {
  upstreamBasePath: string;
  sanitizeJsonBody?: (body: unknown) => unknown;
  stream?: boolean;
}) {
  return async function proxy(c: Context<HonoEnv>) {
    return proxyToBackendWithPolicy(c, options);
  };
}
```

```js
// backend/src/routes/chat.js
// Remove reverse proxy routes once worker feed endpoints are authoritative.
// Backend should not call Worker over HTTP for public request handling.
```

구현 순서:

1. governance contract를 prefix 기준에서 route 기준으로 확장
2. `chat`, `notifications`, `images`, `rag` 같은 hybrid surface를 세분화
3. backend reverse proxy endpoint 제거
4. worker proxy route는 공통 helper 사용으로 통합

대상 파일:

- `shared/src/contracts/service-boundaries.js`
- `backend/src/routes/registry.js`
- `workers/api-gateway/src/routes/registry.ts`
- `workers/api-gateway/src/routes/chat.ts`
- `backend/src/routes/chat.js`
- `scripts/check-route-governance.mjs`

완료 조건:

1. 한 public route가 동시에 두 service의 source of truth가 되지 않음
2. backend -> worker reverse proxy 제거
3. governance snapshot이 실제 mount graph를 표현

롤백:

- 신규 route matcher와 registry를 feature flag 또는 compatibility registry로 공존시킬 수 있음

### Patch 5. Terminal capability를 service 레이어에서 최종 보증

문제:

- 현재 `getTerminalGatewayUrl()`는 feature flag를 보지 않습니다.
- 결과적으로 service 직접 호출 시 UI 차단을 우회할 수 있습니다.

이전 코드:

```ts
export function getTerminalGatewayUrl(): string | null {
  try {
    const override = localStorage.getItem('aiMemo.terminalGatewayUrl');
    if (override) {
      const parsed = JSON.parse(override);
      if (typeof parsed === 'string' && parsed) return parsed;
    }
  } catch {}

  if (typeof window !== 'undefined') {
    const runtimeWindow = window as RuntimeWindow;
    const runtimeUrl =
      runtimeWindow.APP_CONFIG?.terminalGatewayUrl ??
      runtimeWindow.__APP_CONFIG?.terminalGatewayUrl;
    if (typeof runtimeUrl === 'string' && runtimeUrl) {
      return runtimeUrl;
    }
  }

  const envUrl = import.meta.env.VITE_TERMINAL_GATEWAY_URL;
  if (typeof envUrl === 'string' && envUrl) {
    return envUrl;
  }

  return null;
}
```

이후 코드(제안):

```ts
function isTerminalFeatureEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as RuntimeWindow & {
    APP_CONFIG?: { features?: { terminalEnabled?: boolean } };
    __APP_CONFIG?: { features?: { terminalEnabled?: boolean } };
  };

  return (
    runtimeWindow.APP_CONFIG?.features?.terminalEnabled ??
    runtimeWindow.__APP_CONFIG?.features?.terminalEnabled ??
    false
  ) === true;
}

export function getTerminalGatewayUrl(): string | null {
  if (!isTerminalFeatureEnabled()) {
    return null;
  }

  try {
    const override = localStorage.getItem('aiMemo.terminalGatewayUrl');
    if (override) {
      const parsed = JSON.parse(override);
      if (typeof parsed === 'string' && parsed) return parsed;
    }
  } catch {}

  // runtime/env lookup stays the same
}

export function hasTerminalGatewayUrl(): boolean {
  return typeof getTerminalGatewayUrl() === 'string';
}
```

대상 파일:

- `frontend/src/services/realtime/terminal.ts`
- `frontend/src/test/terminal.service.test.ts`
- `frontend/src/components/features/memo/fab/hooks/useRealTerminal.ts`

완료 조건:

1. UI 외부에서 service를 직접 호출해도 disabled 상태면 연결되지 않음
2. terminal feature flag와 runtime URL 의미가 동일해짐

롤백:

- service 내부 guard만 제거하면 이전 동작 복귀 가능

### Patch 6. Proxy-heavy worker routes를 공용 helper로 통합

문제:

- `notifications.ts`, `chat.ts`, `images.ts`, `rag.ts`, `admin-logs.ts`, `analytics.ts`가 각자 CORS/header/error/timeout 처리를 중복 구현합니다.
- 이 상태에서는 인증 헤더, `X-Backend-Key`, 502/503 매핑, streaming header 정책이 route마다 미세하게 달라질 수 있습니다.

이전 코드:

```ts
function buildProxyHeaders(request: Request, env: Env): Headers { ... }
async function proxyNotificationsRequest(...) { ... }
```

이후 코드(제안):

```ts
// workers/api-gateway/src/lib/backend-proxy.ts
export async function proxyToBackendWithPolicy(
  c: Context<HonoEnv>,
  options: {
    upstreamPath: string;
    method?: string;
    stream?: boolean;
    sanitizeClientModel?: boolean;
    requireAuth?: boolean;
  }
) {
  // one place for:
  // - backend url construction
  // - X-Backend-Key injection
  // - X-Forwarded-* propagation
  // - CORS normalization
  // - 502/503 mapping
  // - SSE buffering headers
}
```

```ts
// workers/api-gateway/src/routes/notifications.ts
notifications.get('/stream', requireAuth, (c) =>
  proxyToBackendWithPolicy(c, {
    upstreamPath: '/api/v1/notifications/stream',
    stream: true,
    requireAuth: true,
  })
);
```

대상 파일:

- `workers/api-gateway/src/lib/backend-proxy.ts` 신규
- `workers/api-gateway/src/routes/chat.ts`
- `workers/api-gateway/src/routes/notifications.ts`
- `workers/api-gateway/src/routes/images.ts`
- `workers/api-gateway/src/routes/rag.ts`
- `workers/api-gateway/src/routes/admin-logs.ts`
- `workers/api-gateway/src/routes/analytics.ts`

완료 조건:

1. proxy route의 header/CORS/error semantics가 일관됨
2. route 단위 코드량 감소
3. boundary drift 진단이 쉬워짐

### Patch 7. `api`와 `ai-worker` 배포 단위를 분리

문제:

- 현재 `k3s/api.yaml`은 API process와 AI worker process를 한 pod에 넣고 있습니다.
- `sqlite PVC + Recreate + single replica`와 합쳐져 scale/failover 전략을 제한합니다.

이전 코드:

```yaml
spec:
  replicas: 1
  strategy:
    type: Recreate
  template:
    spec:
      initContainers:
        - name: sync-repo
          command:
            - /bin/sh
            - -ec
            - |
              repo_url="${CONTENT_GIT_REPO_AUTH:-$CONTENT_GIT_REPO}"
              test -n "$repo_url"
              git clone --depth 1 --branch "$CONTENT_GIT_REF" "$repo_url" /repo
      containers:
        - name: api
          volumeMounts:
            - name: sqlite-data
              mountPath: /app/.data
        - name: ai-worker
          image: ghcr.io/choisimo/blog-api:latest
          command: ["node", "src/workers/ai-worker.js"]
```

이후 코드(제안):

```yaml
# k3s/api.yaml
spec:
  replicas: 1
  strategy:
    type: Recreate # keep until SQLite is externalized
  template:
    spec:
      initContainers:
        - name: sync-repo
      containers:
        - name: api
          image: ghcr.io/choisimo/blog-api:latest
          volumeMounts:
            - name: sqlite-data
              mountPath: /app/.data
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-worker
  namespace: blog
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ai-worker
  template:
    metadata:
      labels:
        app: ai-worker
    spec:
      automountServiceAccountToken: false
      imagePullSecrets:
        - name: ghcr-creds
      containers:
        - name: ai-worker
          image: ghcr.io/choisimo/blog-api:latest
          command: ["node", "src/workers/ai-worker.js"]
          envFrom:
            - configMapRef:
                name: blog-app-config
            - secretRef:
                name: blog-app-secrets
```

중요한 운영 가드:

1. SQLite가 남아 있는 한 `api`는 `RollingUpdate`로 바꾸지 않습니다.
2. 먼저 `ai-worker`만 분리합니다.
3. 그 다음 세션/queue/outbox/state를 외부 저장소로 이동합니다.
4. 마지막에 `api`를 `RollingUpdate + HPA + PDB`로 전환합니다.

추가 운영 정리:

1. terminal optional overlay는 계속 분리 유지
2. privileged DinD는 optional 영역에만 남기고 base set으로 확산하지 않음

대상 파일:

- `k3s/api.yaml`
- `k3s/kustomization.yaml`
- 필요 시 `k3s/README.md`

완료 조건:

1. API restart가 AI queue worker restart를 강제하지 않음
2. AI worker replica를 별도로 조정 가능
3. SQLite 외부화 전후의 rollout policy가 명시적으로 분리됨

### Patch 8. Dynamic AI config fallback을 로그가 아닌 상태로 노출

문제:

- 현재 dynamic config fallback은 `warn` 로그로는 남지만 health surface에 충분히 드러나지 않습니다.
- 운영자는 degraded 상태를 놓치기 쉽습니다.

이전 코드:

```js
logger.warn(
  { operation: 'refresh' },
  'Failed to fetch AI config from Worker, using env fallback',
  { error: err.message }
);

const fallback = getEnvFallbackSnapshot();
currentSnapshot = fallback;
return fallback;
```

이후 코드(제안):

```js
let aiConfigHealth = {
  status: 'ok',
  source: 'worker',
  reason: null,
  updatedAt: null,
};

function markAiConfigHealth(next) {
  aiConfigHealth = { ...aiConfigHealth, ...next, updatedAt: new Date().toISOString() };
}

export function getAiConfigHealth() {
  return aiConfigHealth;
}
```

```js
// on fallback
markAiConfigHealth({
  status: 'degraded',
  source: 'env',
  reason: err.message,
});
```

```js
// expose in health/admin route
res.json({
  ok: true,
  data: {
    aiConfig: getAiConfigHealth(),
  },
});
```

대상 파일:

- `backend/src/services/ai/dynamic-config.service.js`
- `backend/src/routes/config.js` 또는 health/admin route
- `backend/src/lib/metrics.js` 선택적 확장

완료 조건:

1. degraded fallback이 health surface에 노출됨
2. 운영자가 env fallback 상태를 즉시 식별 가능

### Patch 9. Worker artifact outbox 상태와 수동 flush를 backend-key 기반 운영 surface로 노출

문제:

- 현재 worker artifact recovery surface는 `workers/api-gateway/src/routes/admin-outbox.ts`의 admin JWT에 묶여 있습니다.
- `ssh blog` 같은 서버 측 운영 경로에서는 browser-admin token 없이 worker outbox 상태를 직접 확인하기 어렵습니다.
- 실제 원격 증상은 `warming`/`pending`이 길게 지속되는 형태라서, "지금 pending인지", "dead-letter인지", "cron flush가 아예 안 돈 것인지"를 바로 구분할 수 있어야 합니다.

이전 코드:

```ts
// workers/api-gateway/src/routes/admin-outbox.ts
adminOutbox.use('*', requireAdmin);

adminOutbox.post('/:stream/ai-flush', async (c) => {
  const stream = c.req.param('stream');
  const limit = Math.min(parseLimit(c.req.query('limit'), 10), 50);

  if (stream !== AI_ARTIFACT_STREAM) {
    return badRequest(c, `Unsupported stream: ${stream}`);
  }

  const result = await flushAiArtifactOutbox(c.env, { limit });
  return success(c, result);
});
```

이후 코드(제안):

```ts
// workers/api-gateway/src/routes/internal.ts
internal.get('/ai/outbox/status', async (c) => {
  const authError = requireBackendKey(c);
  if (authError) return authError;

  const [summary, stuck, scheduler] = await Promise.all([
    getDomainOutboxSummary(c.env.DB, AI_ARTIFACT_STREAM),
    listStuckDomainOutboxEvents(c.env.DB, {
      stream: AI_ARTIFACT_STREAM,
      olderThanMinutes: 5,
      limit: 20,
    }),
    getLatestSchedulerDecision(c.env.DB, 'artifact-scheduler'),
  ]);

  return success(c, {
    stream: AI_ARTIFACT_STREAM,
    summary,
    stuck,
    scheduler,
  });
});

internal.post('/ai/outbox/flush', async (c) => {
  const authError = requireBackendKey(c);
  if (authError) return authError;

  const limit = Math.min(parseLimit(c.req.query('limit'), 10), 50);
  const result = await flushAiArtifactOutbox(c.env, { limit });
  return success(c, result);
});
```

```bash
# 운영 예시
curl -s https://api.nodove.com/api/v1/internal/ai/outbox/status \
  -H "X-Backend-Key: <backend-key>"

curl -s -X POST "https://api.nodove.com/api/v1/internal/ai/outbox/flush?limit=20" \
  -H "X-Backend-Key: <backend-key>"
```

대상 파일:

- `workers/api-gateway/src/routes/internal.ts`
- `workers/api-gateway/src/lib/domain-outbox.ts`
- `workers/api-gateway/src/lib/ai-artifacts.ts` 또는 scheduler decision 조회 helper
- `workers/api-gateway/test/admin-outbox-recovery.test.ts`
- 신규 internal route test

완료 조건:

1. `ssh blog` 환경에서도 backend key만으로 worker artifact outbox summary 조회 가능
2. `pending / processing / dead_letter`와 마지막 scheduler decision을 즉시 구분 가능
3. public route가 `warming`에 고착될 때 운영자가 manual flush와 stuck event 확인을 바로 수행 가능

## 5. 단계별 실행 순서

### 0단계. Worker artifact 운영 가시성 확보

1. Patch 9 적용
2. `ssh blog` 기준 runbook 명령 정리
3. outbox summary와 manual flush 경로 검증

종료 조건:

- backend key만으로 worker artifact pending/dead-letter 상태를 확인 가능
- 카드 생성/uncached 번역이 `warming` 또는 `202`에 머물 때 원인을 1차 분류할 수 있음

### 1단계. Release gate 복구

1. Patch 1 적용
2. Patch 2 중 shared contract `.d.ts`와 치명적인 TS cluster 우선 정리
3. `frontend build/type-check` green 확보

종료 조건:

- `npm --prefix frontend run type-check`
- `npm --prefix frontend run build`

### 2단계. Dead path 제거와 capability 정리

1. Patch 3 적용
2. Patch 5 적용
3. 관련 frontend unit test 보강

종료 조건:

- chat transport surface가 SSE-only로 정리됨
- terminal disabled 상태에서 service 직접 호출도 실패

### 3단계. Boundary contract 단일화

1. Patch 4 route-level ownership contract 도입
2. Patch 6 proxy helper 공용화
3. backend reverse proxy route 제거

종료 조건:

- contract 문서, route registry, 실제 mount graph가 동일
- ownership을 prefix가 아니라 operation 단위로 설명 가능

### 4단계. Infra 분리

1. Patch 7로 ai-worker 분리
2. Patch 8로 degraded observability 강화
3. SQLite 외부화 여부 결정 후 rollout strategy 변경

종료 조건:

- `api`와 `ai-worker`의 scale unit 분리
- degraded AI config 상태의 운영 가시성 확보

## 6. 검증된 출처 및 실행 근거

### 6.1 실행 명령

아래 명령을 실제로 실행해 결과를 확인했습니다.

```bash
pdftotext '/home/nodove/다운로드/blog_service_audit_report.pdf' - | sed -n '300,420p'
pdftotext '/home/nodove/다운로드/blog_service_audit_report.pdf' - | sed -n '1720,1878p'

npm --prefix frontend run type-check
npm --prefix frontend run type-check --silent 2>&1 | rg -c "error TS"
npm --prefix frontend run build

npm run contracts:check
npm run routes:check
npm run routes:check:orphans

npm --prefix backend test

ssh blog 'hostname; pwd; whoami; date; uname -a'
ssh blog 'kubectl -n blog get pods -o wide'
ssh blog 'kubectl -n blog get deploy api -o yaml | sed -n "1,260p"'

ssh blog "printf '%s' '{\"paragraph\":\"hello world\",\"postTitle\":\"test\"}' | curl -i -s https://api.nodove.com/api/v1/chat/session/test/lens-feed -H 'Content-Type: application/json' --data-binary @- --max-time 30"
ssh blog "sleep 4; printf '%s' '{\"paragraph\":\"hello world\",\"postTitle\":\"test\"}' | curl -i -s https://api.nodove.com/api/v1/chat/session/test/lens-feed -H 'Content-Type: application/json' --data-binary @- --max-time 30"

ssh blog 'curl -i -s https://api.nodove.com/api/v1/public/posts/2026/ai-agent-arena-2026-overview-and-comparison/translations/en --max-time 30'
ssh blog 'curl -i -s https://api.nodove.com/api/v1/public/posts/2026/ai-agent-arena-2026-overview-and-comparison/translations/ko --max-time 30'
ssh blog 'sleep 18; curl -i -s https://api.nodove.com/api/v1/public/posts/2026/ai-agent-arena-2026-overview-and-comparison/translations/ko --max-time 30'
ssh blog 'curl -i -s https://api.nodove.com/api/v1/public/posts/2026/ai-agent-arena-2026-overview-and-comparison/translations/ja --max-time 30'
ssh blog 'curl -i -s -X POST https://api.nodove.com/api/v1/internal/posts/2026/ai-agent-arena-2026-overview-and-comparison/translations/ja/generate?async=true -H "Content-Type: application/json" --data "{}" --max-time 20'

ssh blog 'curl -i -s https://api.nodove.com/api/v1/ai/queue-stats -H "X-Backend-Key: <backend-key>" --max-time 20'
ssh blog 'kubectl -n blog logs deploy/api -c api --since=60m | grep -nE "POST /api/v1/ai/generate|Async generation completed|Enqueueing async generation" | tail -n 80'

ssh blog 'kubectl -n blog exec api-59df9f9b4c-lw64p -c api -- sh -lc "node <<'\''NODE'\''
const Database = require(\"better-sqlite3\");
const db = new Database(\"/app/.data/blog.db\", { readonly: true });
const rows = db.prepare(\"SELECT post_slug, year, target_lang, updated_at FROM post_translations_cache ORDER BY updated_at DESC LIMIT 10\").all();
console.log(JSON.stringify(rows, null, 2));
NODE"'
```

### 6.2 주요 코드 근거

- frontend build 실패 근거
  - `frontend/src/bootstrap.ts:1-4`
  - `frontend/config/vite.config.ts:31-59`
- chat WS dead path 근거
  - `frontend/scripts/generate-runtime-config.js:50-60`
  - `workers/api-gateway/src/index.ts:207-235`
  - `workers/api-gateway/src/routes/chat.ts:102-108`
  - `frontend/src/services/chat/api.ts:242-286`
  - `frontend/src/services/chat/config.ts:71-140`
- route ownership drift 근거
  - `shared/src/contracts/service-boundaries.js:8-47`
  - `backend/src/routes/registry.js:27-59`
  - `workers/api-gateway/src/routes/registry.ts:43-112`
  - `backend/src/routes/chat.js:128-195`
  - `backend/src/routes/chat.js:879-910`
  - `workers/api-gateway/src/routes/notifications.ts:20-169`
  - `backend/src/routes/notifications.js:122-245`
- terminal capability 근거
  - `shared/src/contracts/public-runtime-config.js:13-47`
  - `frontend/src/services/realtime/terminal.ts:45-74`
  - `frontend/src/services/realtime/terminal.ts:164-175`
  - `frontend/src/services/realtime/terminal.ts:286-310`
  - `frontend/src/components/features/memo/fab/hooks/useRealTerminal.ts:55-127`
- 원격 카드/번역 장애 진단 근거
  - `workers/api-gateway/src/routes/chat.ts:124-222`
  - `frontend/src/services/chat/api.ts:191-210`
  - `frontend/src/components/features/sentio/hooks/useLensDeck.ts:278-303`
  - `workers/api-gateway/src/lib/feed-normalizers.ts:387-406`
  - `workers/api-gateway/src/lib/ai-artifact-outbox.ts:231-300`
  - `workers/api-gateway/src/lib/ai-artifact-outbox.ts:365-433`
  - `workers/api-gateway/src/lib/ai-artifact-outbox.ts:507-640`
  - `workers/api-gateway/src/lib/translation-service.ts:6-12`
  - `workers/api-gateway/src/lib/translation-service.ts:231-275`
  - `workers/api-gateway/src/routes/translate.ts:293-330`
  - `workers/api-gateway/src/routes/translate.ts:488-585`
  - `workers/api-gateway/src/index.ts:319-323`
  - `workers/api-gateway/src/routes/admin-outbox.ts:23-127`
- deployment topology 근거
  - `k3s/api.yaml:33-58`
  - `k3s/api.yaml:74-158`
  - `k3s/optional/terminal/terminal-optional.yaml:33-48`
- dynamic AI config degraded fallback 근거
  - `backend/src/services/ai/dynamic-config.service.js:166-258`
  - `backend/src/services/ai/dynamic-config.service.js:338-351`

## 7. 불확실성 및 잔여 리스크

1. `workers/node_modules`가 현재 워크트리에 없어 worker type-check/test는 이번 턴에 재실행하지 못했습니다. 보고서의 worker green 상태는 코드 구조와 문서상으로는 맞아 보이지만, 이번 검토에서는 실행 증거를 추가 확보하지 못했습니다.
2. `k3s/api.yaml`과 `package.json`은 이미 수정된 워크트리 상태였습니다. 이 문서는 현재 워크트리를 기준으로 작성했으며, 기존 변경을 되돌리지 않았습니다.
3. route-level ownership으로 전환하려면 `check-route-governance.mjs` 자체의 모델 변경이 필요합니다. 이 작업은 코드 수정량보다 검증 체계 수정량이 더 클 수 있습니다.
4. SQLite를 유지한 채 API rollout 전략만 바꾸는 것은 위험합니다. `ai-worker` 분리와 `RollingUpdate` 전환은 같은 단계가 아닙니다.
5. chat boundary는 feed, live stream, message, task, aggregate가 서로 다른 ownership과 state store를 가질 수 있으므로, 단순 "한 서비스로 통합"보다 operation별 ownership이 더 현실적입니다.
6. 원격 `api` pod SQLite가 비어 있는데도 public 번역 cache가 응답한다는 사실은 worker-side storage가 실제 source of truth임을 강하게 시사합니다. 다만 Cloudflare Worker의 원격 D1/R2 상태와 로그를 이번 턴에는 직접 열람하지 못했으므로, stuck event가 `pending`인지 `dead_letter`인지까지는 확정하지 못했습니다.
7. 카드 생성의 가장 강한 가설은 `normalizeLensFeedResponse()` 실패 또는 snapshot 저장 실패이지만, Cloudflare Worker 로그 부재 때문에 "AI generate 완료 후 어느 statement에서 끊기는지"는 코드상 추정 단계입니다.
8. uncached 번역 `202` 고착은 cron-only flush cadence, idempotency 재사용, 또는 기존 pending translation job 재사용 중 하나일 가능성이 큽니다. 이 역시 Patch 9 같은 운영 surface 없이는 원격 서버에서 즉시 분해할 수 없습니다.

## 8. 최종 제안

가장 안전한 실행 순서는 다음과 같습니다.

1. Patch 9로 worker artifact outbox 상태/flush 운영 surface를 먼저 확보
2. `frontend build/type-check` 복구
3. dead chat WS path 제거
4. terminal capability를 service 레이어에서 잠금
5. shared contract 타입 선언 추가
6. route ownership을 operation 단위로 세분화
7. `api`와 `ai-worker` 배포 단위 분리

즉, 이 코드베이스의 다음 리팩토링은 "새 기능 추가"가 아니라 "release 가능 상태를 회복하면서 경계 모델을 코드와 일치시키는 작업"으로 보는 것이 맞습니다.

원격 배포 서버 증상까지 반영하면 우선순위는 두 갈래입니다.

1. 현재 운영 장애 대응: `warming/pending` 고착 원인을 볼 수 있도록 worker outbox 상태와 manual flush surface를 먼저 열 것
2. 다음 릴리즈 안정화: frontend release gate, shared contract, route ownership, deployment unit 분리를 순서대로 정리할 것
