# 작업공간 디자인 구현 및 검증

`architecture.md`의 코드 근거를 바탕으로 frontend-architect 감사 단계를 마친 뒤 frontend-designer 스킬을 적용했다. 아래는 이 담당 범위의 결과이며, 전체 사이트·인증·실제 API 완료 주장이 아니다.

## 변경

- `src/styles/ui-editor.css`: editor 자체 폭이 1120px 이하이면 기존 write/preview/tools pane을 선택하는 레이아웃을 사용한다. 관리자 sidebar 안과 독립 글쓰기 경로 모두 동일한 component/state를 유지한다. 넓은 화면에서 Write만 선택했다가 좁혀도 compact Preview가 제대로 보이게 selector 우선순위를 정리했다.
- `src/styles/ui-workspaces.css`: 짧은 desktop 화면의 sticky 관리자 navigation에 내부 스크롤을 허용하고 자식 축소를 막았다. 관리자 버튼 및 Insight 모바일 버튼의 최소 크기는 44px이다.
- `src/components/features/insight-workspace/InsightWorkspacePage.tsx`, `src/styles/ui-insight.css`: 보관함에서 매핑되는 항목을 선택하면 inspector로 이동하고 기존 switchPane focus 처리를 재사용한다. 카드 제목/메타와 삭제/고정 버튼을 별도 grid 열에 배치하여 44px 버튼과 콘텐츠가 겹치지 않게 했다.
- `src/components/features/chat/widget/index.tsx`: 모바일 sidebar SheetTitle을 추가했다. 이 담당 변경에서는 chat의 focus trap/Escape 동작을 변경하지 않았다.
- `src/components/features/admin/ai/PromptsManager.tsx`: 좁은 화면의 모드 탐색을 위로 쌓고 2열로 정렬한다. 현재 모드의 aria-pressed, textarea 제목 연결, 긴 제목/저장 액션 줄바꿈을 추가했다.
- `src/components/features/admin/logs/LogViewer.tsx`: 제목/레벨/서비스 검색/액션을 줄바꿈 가능한 도구행으로 만들었다. 레벨 및 일시정지 상태를 aria-pressed로 표현하고 서비스 검색 이름과 키보드 접근 가능한 로그 region을 추가했다. 로그의 시간/서비스/메시지도 작은 화면에서 줄바꿈하며 목록 높이는 viewport에 맞게 제한한다.

새 API, 전역 상태, 인증 경로, 저장 형식, 프로덕션 preview route를 추가하지 않았다. 색상과 typography는 기존 ui 토큰을 사용한다. 새로운 레이아웃 애니메이션은 없다. hover/focus/pressed/disabled는 기존 토큰 스타일을 유지하고 선택 상태의 색상과 ARIA 정보를 보완했다. 로딩/오류 데이터 처리 흐름과 PR/저장/로그 stream controller는 유지했다.

## 브라우저 증거

테스트 전용 `scripts/design-verification/workspace.html`과 `workspace-harness.jsx`가 실제 AdminDashboard/NewPost 및 도메인 컴포넌트를 React로 렌더링한다. Vite의 실제 스타일/Tailwind 변환을 사용한다. Browser runner가 모든 API/외부 요청을 차단하거나 명시적인 fixture로 응답한다. 따라서 CSS 독립 HTML보다 강한 component/rendering 증거지만 App/AuthGuard 전체 경로와 실제 인증/API를 증명하지는 않는다.

| 실행 | 결과 | 증명 범위 |
|---|---|---|
| `workspace-browser.mjs` | 39 사례 통과 | 관리자/독립 editor × light/dark/terminal × 375/768/1024/1280/1440/1920px의 36개 배치 + 테마별 짧은 nav 3개 |
| `admin-sections-browser.mjs` | 30 사례 통과 | Prompts/Logs × 3테마 × 320/375/768/1024/1440px |
| editor pane/state | 통과 | compact write/preview/tools 노출, desktop 모드→compact 전환, resize 후 같은 편집 내용 보존 |
| 관리자 짧은 높이 | 통과 | 1280×420에서 sidebar clientHeight356/scrollHeight631, Workers focus로 스크롤 도달 |
| Logs/Prompts controls | 통과 | 보이는 버튼/input/textarea 최소44×44px, viewport 안에 조작 영역, document 가로넘침 없음 |
| Logs 내부 메시지 | 통과 | 실제 fixture 로그가 작은 폭에서 목록 가로 스크롤 없이 표시, 레벨 선택/일시정지 상태와 검색 입력 동작 |

`workspace-browser-results.json`, `admin-sections-browser-results.json`에 수치가 저장되어 있다. 스크린샷은 같은 디렉터리의 `workspace-*.png` 18개와 `admin-prompts-*.png`/`admin-logs-*.png` 12개다. 대표 light 관리자1024px, terminal 관리자375px, Prompts light375px, Logs dark375px 이미지를 직접 열어 배치를 확인했다.

실측 예시:

| 진입 / viewport | 적용 배치 | 작성 / preview / tools 폭 |
|---|---|---|
| 관리자 1024px | compact | 작성703px |
| 관리자 1280px | compact | 작성935px |
| 관리자 1440px | wide split | 377px /377px /334px |
| 독립 editor1280px | wide split | 428px /428px /310px |
| 관리자375px | compact | 작성300px |

스크롤바가15px를 차지하는 Chromium 환경의 실측이다. 모든 화면 높이/폰트/모바일 브라우저에서 같은 픽셀 수치가 된다고 주장하지 않는다. 실제 휴대전화 소프트 키보드, 스크린리더, API 저장/권한 상태는 별도 검증 범위다.

## 테스트 및 한계

- InsightWorkspacePage sanitizer5개 + Chat widget display helper3개: **8/8 통과**. 이 테스트 자체는 CSS나 실제 focus 동작을 증명하지 않는다.
- PromptsManager 기존3개: **3/3 통과**.
- LogViewer의 toolbar accessible label/일시정지 상태 테스트: **1/1 통과**.
- 변경된4개 TSX 파일 ESLint: **오류0**, 기존 mixed exports에 대한 Fast Refresh 경고7개.
- 전체 `LogViewer.test.tsx`는6개 중5개 통과,1개 실패: line300의 resume stream append assertion에서 resumed-log 대신 existing-0. 이번 변경의 stream controller/parser는 수정하지 않았지만 전체 suite 통과로 기록하지 않는다.
- `PostEditorWorkspace.test.tsx --bail=1`는2개 통과 후 line173의 삭제 draft가 pending autosave로 재생성되는 assertion에서 실패했다. 해당 실패는 기존 LOCAL_INTEGRATION.md에도 기록되어 있고 이 작업에서 editor document logic을 변경하지 않았다. 그럼에도 나머지 suite를 통과로 가정하지 않는다.
- JSX harness 파일은 별도 scripts 경로에 있으며 `.tsx`를 사용해 tsconfig.node의 DOM/JSX 설정에 충돌하던 초기 상태를 `.jsx`로 수정했다. 원본 src는 기존 app 타입 검사 범위에 그대로 남아 있다.

재현:

```sh
# frontend에서 Vite dev server가 4173에 실행 중인 상태
node scripts/design-verification/workspace-browser.mjs
node scripts/design-verification/admin-sections-browser.mjs
```

설치된 Playwright 기본 Chromium이 없는 이번 환경에서는 `DESIGN_CHROMIUM_PATH=/home/nodove/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`을 명시했다. 서버 주소는 DESIGN_BASE_URL로 지정할 수 있다.

## 남은 전체 감사 항목

- Insight 실제 route에서 보관함 선택 focus와 카드44px 재측정은 root의 공개화면 검증으로 합쳐야 한다.
- Chat 전체 dialog focus/복귀/중첩 overlay, terminal modal keyboard 동작은 이 담당 구현 범위에 포함하지 않았다.
- AI Prompts deep link의 현재 subtab이 오른쪽으로 숨겨지던 문제는 후속 AdminSubtabs 수정으로 해결했다. 아래 검증을 참고한다.
- terminal editor의 민트색 제출 버튼에 흰 글자가 보이는 기존 shared 대비 문제를 root에 전달했다.
- 최초69사례는 전체 관리자 section/subtab을 포함하지 않는다. 후속 AdminSubtabs3사례와 아래 남은 관리자136사례를 합해 담당 브라우저 증거는 총208사례이며, 실제 상태별 범위는 아래 표와 같다.

## 후속 수정 — 현재 관리자 subtab 노출

`src/components/molecules/AdminSubtabs.tsx`에서 선택된 탭의 위치를 측정해 해당 tablist의 `scrollLeft`만 필요한 만큼 이동한다. URL 선택값/탭 label 변경과 tablist 크기 변경에 반응한다. 키보드 방향키/Home/End의 focus는 `preventScroll: true`로 이동한 뒤 가로 위치만 조정하므로 바깥 문서가 세로로 움직이지 않는다. 관리 대상 UI primitive는 수정하지 않았다.

- 기존 AdminSubtabs 테스트 **10/10 통과**, 파일 ESLint 오류/경고0.
- `admin-subtabs-browser.mjs`의 실제 AdminDashboard fixture **3사례 통과**: 375px에서 Prompts 직접 진입, ArrowLeft로 Traces 선택/포커스, 1440px→320px resize 뒤 활성 Prompts 노출.
- 직접 진입 시 window.scrollY=0 보존. 키보드/resize에서는 window.scrollY=100 보존. 실제 하위 route 내용 높이 변화에 따른 브라우저 scroll clamp를 분리하기 위해 해당 두 테스트에만 body min-height2200px를 둔다. 그 외 component/CSS는 실제 앱을 사용한다.
- 수치와 실제 스크린샷: `admin-subtabs-browser-results.json`, `admin-subtabs-direct-375.png`. 스크린샷에서 활성 Prompts 탭이 좁은 화면 오른쪽에 완전히 보이는 것을 직접 확인했다.

## 후속 검증 — 남은 관리자 화면

`admin-coverage-browser.mjs`는 실제 AdminDashboard의 남은17개 section/subtab 경로를 320px와1440px, light와terminal에서 확인했다. 각 조합에서 API가503인 상태와 명시적으로 알려진 schema의 빈 fixture를 적용한 상태를 렌더링해 **136사례**를 기록했다. `empty-known`은 모든 요청이 성공한다는 뜻이 아니다. 해당 fixture가 없는 API는 동일하게503으로 응답한다.

최초136사례에서 발견한 문제를 수정한 뒤 영향을 받는10경로80사례를 재측정하여 기존 행을 대체했다. 후속 Models 안내 수정 뒤에는 Playground8개 행을 다시 대체했다. 최종 고유 사례 수는136이며, 재실행을 추가 사례로 세지 않는다. `admin-coverage/results.json`의 모든 사례에서 document 가로넘침, viewport 밖 조작 영역, 이름 없는 input/textarea/select, 지역 scroll container 밖 콘텐츠 넘침, pageerror가0이다. 정상적인 tablist와 table의 내부 가로 스크롤은 화면 결함으로 계산하지 않는다. 측정된 활성 조작 영역에44px 미만의 폭/높이는 없었다.

| 경로 | 실제 관찰 상태 | 이번 범위에 없는 상태 |
|---|---|---|
| `health` | 서비스 health 오류, provider 목록 오류/빈 상태 | 정상 연결과 실제 uptime |
| `rag` | health/collections/index 오류, 사용 가능한 검색 입력과 비활성 검색 버튼 | 검색 성공 결과와 실제 indexing |
| `analytics` | 통계 오류 및 데이터 없는 fallback | 성공 응답 기반 통계/차트 |
| `config` | 로드 오류, 빈 category와 읽기 전용 설정/내보내기 도구행 | 값이 채워진 환경변수 폼과 export 다운로드 |
| `secrets/overview` | 오류,0개 통계/빈 category/빈 최근 활동, encryption OK fixture | 실제 암호화/권한 |
| `secrets/secrets` | 검색/분류/추가 도구행, `Invalid admin API URL` 오류; overview는 fixture 성공 | 목록 요청이 API URL 검증에서 멈춰 성공 빈 목록은 확인하지 못함 |
| `secrets/audit` | 오류, `No audit logs found` | 값이 채워진 감사 로그 및 실제 필터 요청 |
| `workers/workers` | 오류, `No workers found` | 배포/수정 동작 |
| `workers/secrets` | 오류, `No secrets defined` | 비밀 값 저장/노출 |
| `workers/resources` | 오류, 빈 D1/KV/R2 목록 | 실제 리소스 생성/삭제 |
| `content/home-cta` | 로드 오류, 비활성 폼, 기존 기본값 preview | 서버 저장과 성공 로드 |
| `ai/playground` | 오류, 모델0개와 초기 Playground 입력 폼 | 내부 History/Templates 패널의 화면 및 모델 실행 결과 |
| `ai/models` | 오류, `No models found` 및 필터 | 생성/수정/삭제 dialog와 채워진 table |
| `ai/providers` | 오류, `No providers configured`, catalog/add 액션 | catalog 결과 및 provider 저장 |
| `ai/routes` | 오류, `No routes configured` | route 저장과 실제 fallback 실행 |
| `ai/monitoring` | usage 오류, 기간/집계 필터 | 성공 응답 기반 비용/사용량 차트 |
| `ai/traces` | stats 오류, 빈 request table, 검색/상태 필터 | trace detail dialog와 채워진 trace |

9개 관리자 section의 기본 경로와 AI7개 subtab은 기존 editor/Prompts/Logs 검증과 이 표를 합해 모두 실제 컴포넌트로 렌더링했다. 이는 모든 내부 dialog·데이터 상태나 dark 테마의 남은17경로를 전수 검사했다는 뜻은 아니다. 실제 인증, 서버 저장, 외부 서비스 연결은 디자인 완료 증거에 포함시키지 않는다.

### 측정에 따라 적용한 수정

- `rag/RAGManager.tsx:383`: 검색 입력/버튼이 줄바꿈되게 하고 검색 입력을200px 기준으로 늘렸다. 입력 이름은 `RAG 검색어`다.
- `ConfigManager.tsx:548`: 설정 도구행과 export/GitOps 액션을 줄바꿈하여320px에서 badge가 바깥으로 나가지 않게 했다.
- `secrets/SecretsListManager.tsx:492`: 최소 너비로 눌리던 검색 필드를 별도 줄로 배치할 수 있게 하고 검색/분류 이름을 추가했다. `secrets/AuditLogViewer.tsx:124`는 제목/필터 줄바꿈과 필터 이름을 추가했다.
- `ai/ModelsManager.tsx:513`, `ai/ProvidersManager.tsx:353`, `ai/RoutesManager.tsx:504`: 제목과 추가 액션이 작은 폭에서 줄바꿈된다. Models 검색 이름도 추가했다. 수정 전 Providers의 Add Provider 버튼은320px에서 오른쪽360px까지 벗어났고, 최종 화면에서는 완전히 보인다.
- `ai/Playground.tsx:604`: 기존 System Prompt/User Prompt/Max Tokens label을 실제 입력의 id에 연결했다.
- `ai/UsageMonitor.tsx:225`: 제목/필터 줄바꿈과 기간/집계 이름을 추가했다. `ai/TraceViewer.tsx:472`는 검색/필터 줄바꿈과 이름을 추가했다.

위10파일은 class/aria-label/htmlFor/id만 수정했다. shared CSS와 UI primitives, 인증/서비스/상태/제출 로직을 변경하지 않았다. 최종 `ai-providers-empty-known-light-320.png`, `rag-unavailable-light-320.png`, `config-empty-known-light-320.png`, `secrets-secrets-empty-known-light-320.png`를 직접 열어 액션·입력·오류 문장의 배치를 확인했다. 모든 경로의320px light 화면은 `admin-coverage/`에 있다.

### 추가 단위 검사와 변경 전 대조

10개 변경 feature의 기존 단위 테스트48개는 **40통과/8실패**, 파일 단위4통과/6실패다. 오류를 현재 UI 변경의 회귀로 단정하지 않기 위해, 같은 테스트/환경에서 이10개 TSX의 본문만 HEAD `4a24b57b`로 공급하는 Vite pre-transform을 사용했다. 생산 파일을 되돌리지 않는 읽기 전용 대조이며, 변경 전 소스에서도 **40통과/8실패**와 동일한 실패 이름/오류 첫 문장이 나왔다. 실패 DOM에서 새 검색 aria-label이 사라지는 것으로 baseline 소스 적용도 확인했다. 대조 설정은 실행 후 제거했다.

| 기존 실패 | 대조 결과 |
|---|---|
| Models의 `/Test/i` 버튼 선택이 여러 요소에 매칭 | 변경 전/후 동일 |
| Models/Providers/Routes의 Delete menuitem, Routes의 Set as Default menuitem을 찾지 못함 |4개 모두 변경 전/후 동일 |
| RAG의 단일 `Untitled` 검색이 여러 요소에 매칭 | 변경 전/후 동일 |
| Audit filter 변경 후 pagination mock 인자 assertion | 변경 전/후 동일; 최초 기본 reporter 실행에 jsdom의 Radix `scrollIntoView` 미구현 unhandled error1개도 기록 |
| Secrets 생성 fixture의 input 개행 값 기대와 실제 값 불일치 | 변경 전/후 동일 |

축약 결과, 실패 테스트명, baseline/current 소스 hash는 `admin-coverage/unit-baseline-comparison.json`에 있다. 이 대조는10개 파일의 디자인 변경을 격리하며 전체 worktree baseline의 통과를 주장하지 않는다. 실패한 도메인 로직이나 테스트 fixture를 디자인 범위에서 바꾸지 않았다. 해당10개 파일 ESLint는 오류0, 기존 mixed exports 경고16개다.

재현(기존 local Vite 서버 사용):

```sh
DESIGN_ASSERT_CLEAN=1 node scripts/design-verification/admin-coverage-browser.mjs
# 선택 재측정은 기존 results.json의 다른 경로를 보존한다.
DESIGN_ROUTES=rag,config,ai/providers DESIGN_ASSERT_CLEAN=1 node scripts/design-verification/admin-coverage-browser.mjs
```

## 시각 검토 후 보완 — Playground 모델 선택 안내

최초320px 스크린샷에서 Models 영역이 `0/5 selected`만 표시한 채200px 높이로 비어 있던 점을 후속 시각 검토에서 확인했다. `Playground.tsx`에서 기존 `useModels.loading/error`를 읽어 로딩 안내, 오류/Retry models, 활성 모델이 없는 경우의 안내, 실제 선택 목록을 구분했다. 로딩 중에는 빈 목록으로 안내하지 않는다. 재시도는 기존 읽기 함수 `fetchModels(undefined, true)`만 호출한다. 목록 높이는 그대로 유지하여 모델 응답에 따른 패널 높이 변화를 피했다.

각 모델 행의 보이는 모델명·제공자 이름을 checkbox의 `htmlFor/id`에 연결했다. 기존 비교 제한 및 toggle 함수를 보존하면서 클릭 전용 부모 handler를 checkbox의 `onCheckedChange`로 옮겨 Space 키도 지원한다. 긴 이름은 줄바꿈하며, 최소44px 조작 영역과 기존 hover/focus/disabled 토큰을 사용한다. 새로운 API/실행/저장 흐름이나 애니메이션은 추가하지 않았다.

- `Playground.test.tsx`: 기존6개와 신규2개 **8/8 통과**. 기존 오류 테스트는 retry 호출과 빈 목록 미노출을 추가 확인한다. 새 테스트는 loading→empty 전환 및 이름이 연결된 checkbox의 Space/label 선택 해제를 확인한다. 기존 안전한 model payload 및5개 비교 제한 테스트도 통과한다.
- `playground-models-browser.mjs`: 실제 컴포넌트에서 loading/error+retry/empty/populated를320px light/terminal로 확인해 **8/8 통과**. 오류 재시도 후 models 요청2회, populated 상태의 Space 선택과 `1/5 selected`, document/control/text 넘침0, pageerror0을 검증한다. 실제 모델 실행 요청은 보내지 않는다.
- `playground-models/results.json`, `unit-results.json`, 상태별 패널 스크린샷8개를 저장했다. light loading/empty와 terminal error/populated 스크린샷을 직접 열어 안내, 긴 이름, 버튼 배치를 확인했다.
- 기존136사례의 Playground8개 행도 최종 소스로 재측정했다. 새 상태 검증8개를 포함한 담당 브라우저 고유 시나리오 합계는 **216개**다.
- 변경 소스/테스트 ESLint 오류0, 기존 Fast Refresh 경고3개. 앞 절의10파일 baseline 비교는 이 후속 수정 전 스냅샷이며, 최종 Playground의 검증은 여기의8/8 결과를 따른다.

```sh
node scripts/design-verification/playground-models-browser.mjs
```
