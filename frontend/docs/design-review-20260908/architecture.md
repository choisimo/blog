# 전체 디자인 구조 감사 및 구현 계약 — 2026-09-08

이 문서는 현재 React 소스를 읽어 작성한 구조 감사다. 읽기 UX 보고서의 과거 결과를 이번 전체 디자인 검증으로 간주하지 않는다. 아래 줄 번호는 감사 시점의 소스 기준이며 후속 구현으로 바뀔 수 있다. 화면 렌더링, 실제 API 상태, 키보드와 스크린리더 동작은 검증 행렬에 따라 별도 확인해야 한다.

적용한 지침: `frontend/AGENTS.md`, `frontend/src/components/AGENTS.md`, `frontend-architect/SKILL.md`. 이 문서 작성 단계에서는 컴포넌트 구현을 수정하지 않았다. shadcn 관리 대상 `src/components/ui/`는 수동 수정 대상에서 제외한다.

## 1. 우선순위와 현재 코드 증거

| 우선순위 | 발견 사항 | 현재 코드 증거 | 구현 및 검증 계약 |
|---|---|---|---|
| P1 | 상담 주제 입력 중 공백과 줄바꿈을 잃는다 | `src/pages/public/Debate.tsx:29–42,112–118`: onChange가 trim을 포함한 sanitization 호출 | 편집 문자열은 그대로 보존하고 URL 진입/시작 시 정규화. 한국어 문장, 연속 공백, 여러 문단을 직접 입력해 보존 확인 |
| P1 | 공통 인라인 링크 예외가 탐색 링크의 44px 높이를 덮는다 | `src/index.css:1471–1475`: 고특이도 범용 a selector가 min-height/min-width를 unset. `ui-layouts.css:17,63`의 높이 계약보다 우선 | 본문 인라인 링크에만 예외 적용. Footer와 공통 링크의 computed box 측정 |
| P1 | 관리자 에디터가 중간 폭에서 3개 pane을 과도하게 압축한다 | `ui-workspaces.css:5,24,94`의 sidebar/padding과 `ui-editor.css:14,24,61–65`의 tools/split 결합. 기본 mode는 `PostEditorWorkspace.tsx:234–237`의 split | viewport 1024px에서 작성/미리보기는 각각 약215px라는 코드상 추산. editor 자체 가용 폭을 기준으로 단일 pane/나란한 pane 경계를 정하고 실제 1024/1280/1440px 검증 |
| P1 | 관리자 짧은 화면에서 sticky 탐색 하단 접근 위험 | `ui-workspaces.css:14`: 높이 100dvh-64px, 세로 overflow 없음. `AdminDashboard.tsx:40–98`: 9개 항목 | sidebar 자체 스크롤 허용, 짧은 landscape와 200% zoom에서 마지막 Workers/돌아가기 접근 |
| P1 | Prompts의 고정 rail이 모바일 편집영역을 압축한다 | `admin/ai/PromptsManager.tsx:264–265`: 항상 flex + w-44 shrink-0. 모바일 전환 규칙 없음 | 작은 폭은 모드 탐색을 위로 쌓고 editor 전체 폭 확보. 선택/미저장/저장 상태는 동일 컴포넌트 소유 유지 |
| P1 | Logs 도구행이 모바일에서 잘릴 구조 | `admin/logs/LogViewer.tsx:363–433`: 제목, 5개 레벨, 서비스 입력, 3개 버튼이 wrap 없는 1행이며 root는 overflow-hidden | 제목/필터/액션이 여러 줄로 배치될 수 있어야 한다. 375px에서 모든 조작 도달 및 서비스 입력 accessible name 확인 |
| P1 | 모바일 Chat sidebar dialog에 이름이 없다 | `chat/widget/index.tsx:611`: SheetContent에 SheetTitle 또는 명시적 labelledby 없음 | 관리 대상 primitive를 수정하지 않고 사용부에 SheetTitle 추가 |
| P1 | 모바일 fullscreen Chat의 focus containment/복귀 계약 부재 | `chat/widget/index.tsx:387–427`: 직접 role=dialog div. useChatState는 textarea focus만 수행 | modal 의미를 선택하고 그에 맞는 Tab containment/Escape/복귀 구현. nested Sheet/AlertDialog가 열리면 상위가 Escape를 가로채면 안 됨. 별도 동작 조사 필요 |
| P2 | Insight 보관함 선택 결과가 모바일에서 보이지 않는다 | `InsightWorkspacePage.tsx:727–732`의 selectStackItem은 selectedNodeId만 변경. 탐색 선택은 `763–770`에서 switchPane까지 호출 | 매핑되는 보관 항목 선택 시 inspector로 전환하고 해당 region에 focus. 데이터 및 storage key 보존 |
| P2 | 초기 로딩이 콘텐츠보다 큰 페이지 높이를 예약 | `atoms/PageTransitionFallback.tsx:36`: header/footer 안에서 min-h-screen | route main 가용 높이 기준 fallback; 로딩 중 불필요한 두 번째 viewport와 큰 이동 방지 |
| P2 | Terminal 선택자의 범위가 의도와 다르다 | `index.css:1452–1492`의 :not(.terminal)는 root가 아니라 임의 조상과 매칭 | root 테마 selector로 제한. Terminal에서도 44px/control/font 규칙을 별도 명시 |
| P2 | 상담 설명에 내부 구현 표현이 노출된다 | `Debate.tsx:135–142`: prism/chain 분리, mode/intent 지원 설명 | 사용자가 주제와 맥락을 적는 데 필요한 설명으로 변경. 기존 query 진입 기능은 유지 |
| 확인 필요 | Insight 최소높이가 작은 화면보다 크다 | `ui-insight.css:5,96`: min-height 620/640px + 상단 toolbar + map viewport min-height180 | 375×667 및 landscape에서 외부 문서 스크롤과 내부 스크롤의 역할 확인. 길다는 사실만으로 기능 고장으로 단정하지 않음 |
| 확인 필요 | 직접 구현한 terminal modal들의 modal 의미와 키보드 경계 | `memo/fab/components/ShellModal.tsx:79–86`, `RealTerminalModal.tsx:275–280`: aria-modal=true + portal. shell Escape는 input handler에만 존재(`useShellCommander.ts:453`) | backdrop가 열렸을 때 focus/닫기/원래 trigger 복귀 확인. xterm Tab 입력과 일반 UI Tab 이동을 구분 |
| 확인 필요 | FAB의 전역 body overflow 직접 변경 | `memo/fab/index.tsx:163–187`: shell 상태와 별개로 body overflow를 빈 문자열로 설정 | 중첩 Sheet/Dialog 활성화 중 scroll lock이 풀리지 않는지 검증. DOM overlay 상태 소유권 충돌을 CSS로 덮지 않음 |

P1은 사용자 작업 또는 접근 가능성을 직접 막는 문제, P2는 일관성과 발견 가능성을 떨어뜨리는 문제다. 위 코드 분석은 실행 결과가 아니며 “확인 필요” 항목을 확인된 결함으로 확대하지 않는다.

## 2. ADR — 기존 상태를 유지하며 레이아웃 경계를 명확히 한다

**Context.** 공개 읽기 페이지, 그래프 작업공간, 관리자 화면, fullscreen chat이 한 앱에 공존한다. 이미 ui 토큰과 공통 shell이 존재하지만 레거시 전역 CSS가 높은 specificity로 덮으며, viewport 기준 breakpoint가 중첩 sidebar 내부의 실제 여유 공간과 다르다. 따라서 새 테마/새 상태 시스템보다 현재 화면을 올바르게 배치하는 작업이 우선이다.

**Decision.**

1. 기존 light/dark/system/terminal 및 ThemeContext를 유지한다. UI 토큰은 단일 팔레트, ui-adaptive는 legacy/shadcn token bridge, component CSS는 배치와 상태 표현을 담당한다.
2. 공개 페이지는 자연스러운 문서 흐름, 작업공간은 명시적인 pane 경계를 사용한다. 그래프만 자신의 viewport 안에서 pan/scroll한다.
3. editor는 자체 가용 폭에 따라 단일 pane과 3 pane을 결정한다. 단일 pane 전환은 기존 mobilePane을 사용하며 document/content/tool state를 복제하거나 unmount하지 않는다.
4. modal은 accessible name, focus 진입/포획/복귀, Escape, 스크롤 잠금, 중첩 overlay 순서를 한 계약으로 취급한다.
5. App의 route/provider/auth/feature flag는 그대로 유지한다. 디자인 때문에 API를 UI primitive나 layout으로 옮기지 않는다.

**Alternatives considered.** 앱 전체 CSS를 새 체계로 재작성하는 방식은 읽기/관리/portal 전부에 큰 회귀 범위를 만든다. 모바일용 별도 editor 컴포넌트는 draft와 AI 대화 상태가 분기된다. viewport 1024px만을 데스크톱 기준으로 삼으면 관리자 sidebar가 차지하는 폭을 무시한다. 이 대안들은 채택하지 않는다.

**Trade-offs.** 부분별 스타일을 고치면 기존 레거시 규칙 일부가 남으므로 실제 computed style 검증이 필수다. Container query를 쓰면 동일 editor가 /admin/new-post와 /admin/config/content/editor 양쪽에서 가용 폭에 맞게 반응하지만, fallback breakpoint도 필요하다. 기존 pane state는 명칭에 mobile이 들어 있어도 compact 레이아웃까지 담당하도록 유지한다.

**Consequences.** 페이지 작업자는 공통 색상이나 전역 버튼을 새로 선언하지 않는다. 각 팀은 소유한 component와 CSS만 수정한다. 모든 작업공간은 긴 한국어/영문/에러, 빈 상태, 느린 응답, 확대 상태를 검증한다.

## 3. 전체 라우트와 shell 계약

근거는 `src/App.tsx:24–47,93–168,244–355`이다. `frontend/AGENTS.md`의 짧은 route 표보다 실제 등록 코드가 권위 있는 목록이다.

| 경로 | 실제 화면 | Header / Footer / GlobalAssistants |
|---|---|---|
| / | Index | 있음 / 있음 / 기능 상태에 따라 있음 |
| /blog | Blog | 있음 / 있음 / 없음, ai-memo-pad도 제거 |
| /blog/:year/:slug, /post/:year/:slug | 동일 BlogPost | 있음 / 있음 / 있음 |
| /projects | Projects | 있음 / 있음 / 있음 |
| /about | About | 있음 / 있음 / 있음 |
| /contact | /about replace redirect | 도착 경로 기준 |
| /debate | Debate → DebateRoom | 있음 / 있음 / 있음 |
| /insight | InsightWorkspacePage | 있음 / 없음 / 없음. 자체 ChatWidget은 가능 |
| /400, /401, /403, /404, /429, /500, /503 | 각 status page | 있음 / 있음 / 있음 |
| /bad-request, /unauthorized, /forbidden, /too-many-requests | 숫자 status로 replace redirect | 도착 경로 기준 |
| /error, /server-error, /maintenance | /500 또는 /503 redirect | 도착 경로 기준 |
| /admin | DEFAULT_ADMIN_PATH redirect | 없음 / 없음 / 없음 |
| /admin/login | AdminConfig 인증 흐름 | 없음 / 없음 / 없음 |
| /admin/new-post | AuthGuard → NewPost → PostEditorWorkspace | 없음 / 없음 / 없음 |
| /admin/config, /admin/config/:section, /admin/config/:section/:subtab | AuthGuard → AdminConfig → AdminDashboard | 없음 / 없음 / 없음 |
| /admin/auth/callback | AdminAuthCallback | 없음 / 없음 / 없음 |
| * | NotFound | pathname이 /admin/ 또는 /insight/ 접두사면 shell helper가 해당 workspace 방식으로 판단함 |

/insight/하위 알 수 없는 경로와 /admin/하위 알 수 없는 경로의 NotFound는 일반 404와 주변 shell이 다르므로 실제 확인이 필요하다.

### 관리자 화면 범위

`AdminDashboard.tsx:17–25,40–98,252–290`는 9개 section을 지연 로드한다.

| Section | 하위 화면/상태 | 상세 디자인 검증 항목 |
|---|---|---|
| health | Core, RAG, Agent 등 상태 및 refresh | 좁은 카드 안 서비스명/상태/지연시간이 겹치지 않는지, 연결 실패 전체 문구 접근 |
| rag | health, collection, index, search tester | collection명과 진행률, 검색 결과의 긴 제목, 쿼리 입력/빈 결과 |
| analytics | trending, realtime, stats refresh, editor picks, all posts | 목록의 좁은 2열, 편집 form의 label, 검색/정렬/페이지 이동 및 detail dialog |
| logs | level/service filter, pause, clear, reconnect, stream | wrap 도구행, 현재 연결/일시정지 의미, 내부 log scroll 접근 |
| content | editor, home-cta | 편집 pane 폭, draft/PR 검토, 업로드 실패 복구, CTA 편집/preview |
| ai | playground, models, providers, routes, monitoring, traces, prompts | 7개 subtab 횡스크롤 접근, data table 내부 overflow, dialog, Prompts rail |
| config | API 제공 category별 동적 탭 | 긴 env key/value, 변경/저장/실패 상태, 선택 input label |
| secrets | overview, secrets, audit | 마스킹/reveal/편집/삭제 dialog와 상태 badge 의미, audit table |
| workers | workers, secrets, resources | worker accordion, env 선택, operation feedback, 긴 resource 식별자 |

이 감사는 디자인과 상호작용 범위다. 실제 비밀 값 조회/배포/저장 요청으로 화면을 검증할 필요가 없으며 read-only fixture나 이미 승인된 테스트 상태로 해당 UI를 재현한다.

## 4. Layout boundary definition

| 경계 | 레이아웃 계약 |
|---|---|
| 320–599px | 공개 페이지 한 열, 좌우 여백 16px 이상, header는 wordmark + compact actions, 필터는 disclosure. 입력 글꼴 16px, 기본 조작 44×44px 이상 |
| 600–1023px | 읽기 흐름 유지, card/list는 가용폭 따라 정렬. 관리자 전체 nav는 select, Insight는 한 pane 선택. 본문에 기능성 가로 스크롤 없음 |
| 1024px 이상 | 공개 Header full nav, 관리자 sidebar 가능. 다만 editor 동시 pane 여부는 viewport가 아니라 editor 자체 폭으로 판단 |
| editor compact | write / preview / tools를 기존 PaneSwitcher로 선택. 원본 state 유지, hidden pane은 focus 대상에서 제외. format toolbar는 줄바꿈 허용 |
| editor wide | 문서 도구와 작성/preview 병렬 제공. 작성/preview 각각 약320px 이상을 확보할 때만 3 pane. 기존 write/split/preview 선택 의미 유지 |
| Insight desktop | graph + 320–400px inspector, graph 자체 가로/세로 scroll은 명시적 region. 리스트 view를 제공하므로 관계 지도를 반드시 이해해야만 글에 접근할 수 없게 만들지 않음 |
| 1024×600, 1280×720, 확대 | sticky sidebar 자체 스크롤. 폭이 줄면 compact pane으로 전환. 높이 조건 때문에 저장/닫기/탐색 액션이 viewport 바깥에 고정되지 않음 |
| pointer/hover | hover는 보조적 강조만 담당. 제목/액션/현재 상태가 hover 없이 보이고 keyboard focus는 별도 표현 |
| safe area/keyboard | footer dock, fullscreen dialog 및 composer가 inset과 visualViewport에 맞는다. 문서와 내부 scroll 영역을 동시에 무제한 고정하지 않음 |

사진/썸네일은 aspect ratio로 자리를 예약한다. 폰트 교체 전후 heading/container 폭이 크게 달라지지 않게 한다. skeleton/route fallback은 주변 shell을 다시 렌더링하지 않는다. CLS는 최종 브라우저 측정이 필요하며 코드만으로 0이라고 주장하지 않는다.

## 5. Component tree 및 상태 소유권

```text
App
└─ Router → ErrorBoundary → QueryClientProvider → LanguageProvider → ThemeProvider → TooltipProvider
   └─ PublicShell (skip link, 바깥 세로 흐름)
      ├─ RouteHeader → Header (nav/search/settings open 상태)
      ├─ RouteMain (유일한 main landmark, route 선택)
      │  ├─ public pages → PageContainer/PageHeader + 각 domain content
      │  ├─ InsightWorkspacePage
      │  │  ├─ PaneSwitcher (controlled presentation)
      │  │  ├─ InsightExplorer (view/query/filter/pan의 presentation)
      │  │  ├─ PostInspector (세부 탭)
      │  │  ├─ StackTray (보관 표시/필터)
      │  │  └─ optional ChatWidget
      │  └─ AuthGuard → AdminConfig (인증 단계) → AdminDashboard (URL section/subtab)
      │     └─ WorkspaceShell → section managers
      │        └─ PostEditorWorkspace (단일 draft + upload + review + compact/wide state)
      ├─ RouteFooter → Footer (구독 field/status/request)
      ├─ GlobalAssistants → FAB / VisitedPostsMinimap / legacy memo element
      └─ Toaster
```

| 상태 | 현재 소유자 / 유지해야 할 경계 |
|---|---|
| theme/system preference | ThemeContext, root html class와 theme storage |
| language | LanguageContext. layout은 번역 저장 상태를 새로 소유하지 않음 |
| server cache | App QueryClient. 상태/테이블/폼은 기존 domain query 및 services 유지 |
| admin access/session | AuthGuard, AdminConfig, useAuthStore. 디자인 수정으로 auth 우회 금지 |
| admin section/subtab | URL params와 AdminDashboard navigate. 복제된 전역 selectedTab 만들지 않음 |
| editor content/metadata/draft/upload/review | PostEditorWorkspace; CSS pane 전환이 문서 상태를 삭제하거나 clone하지 않음 |
| Insight selection/stack/chat context | InsightWorkspacePage. StackTray의 필터/pinned presentation 상태는 해당 component |
| Chat 메시지/첨부/session/live room | useChatState/useChatSession/useLiveVisitorChat. dialog shell은 close/focus 경계만 담당 |
| FAB/legacy memo | 기존 feature flags/useFabState/custom element. App route 정책 유지 |

Lazy boundary는 기존 route lazy와 관리자 section lazy를 보존한다. 새 레이아웃 요소는 작은 presentation component이므로 별도 dynamic import로 최초 화면을 쪼개지 않는다. Insight의 graph loading/error와 자료 선택은 로딩 fallback으로 state를 재설정하지 않는다.

## 6. 의존성과 data flow 규칙

- 부모 domain이 props로 자료/현재 state를 전달하고, child는 이벤트로 선택/닫기/전환 요청을 올린다.
- PageContainer, PublicShell, WorkspaceShell, WorkspacePanel, PaneSwitcher는 네트워크·storage·auth를 소유하지 않는다.
- API request는 기존 domain hooks/services 경로를 유지한다. 디자인은 성공/로딩/오류를 표현하며 backend 실패를 숨기는 임시 값으로 대체하지 않는다.
- global store 접근은 현재 provider/route/domain controller에 유지한다. 공통 버튼이나 label이 전역 상태를 추가로 읽지 않는다.
- route와 feature별 상태 소유권을 유지하는 한, DOM focus와 aria 상태를 위한 local ref/id는 허용한다.
- `features/` 간 새 직접 의존성을 만들지 않는다. 공통 레이아웃은 organisms/molecules로 둔다.

## 7. 구현자 handoff

| Component | 기존 인터페이스 계약 | 예상 상태 / 변경 이벤트 |
|---|---|---|
| PaneSwitcher | label, value, options[{id,label,controls,disabled?}], onChange(value) | controlled toggle, 비활성 pane은 CSS로 hidden; 전환 후 region focus는 부모 |
| WorkspacePanel | id, title, as?, headingLevel?, description?, actions?, footer?, children | 제목/설명을 연결하며 새 open/network 상태 없음 |
| WorkspaceShell | header?, navigation?, children, className? | route가 main/auth 소유. sidebar overflow와 compact 배치만 처리 |
| PostEditorWorkspace | 기존 public props/서비스 유지 | editorMode와 mobilePane을 보존. compact ↔ wide 전환에서 content/첨부/AI state 보존 |
| Insight selection | onSelectNode(node), onSelect(stackItem) | 매핑된 선택은 selectedNodeId 갱신 + compact inspector 노출 |
| Chat sidebar | open, onOpenChange, 기존 ChatSidebar props | visible 또는 sr-only title로 이름 부여. focus 정책 변경은 별도 검증 작업 |
| Header/Footer | 기존 props 없음 | 기존 navigation/구독/테마/언어/알림 유지. 최소 타깃, 긴 설명, 피드백 레이아웃 개선 |

우선 제약 3가지:

1. route/auth/API/storage 및 단일 문서 상태를 보존한다.
2. 320px 폭, 키보드, 확대, 긴 콘텐츠에서 핵심 조작에 도달할 수 있어야 한다.
3. 모든 테마와 body portal은 같은 token bridge를 사용하며 managed UI 파일은 수정하지 않는다.

렌더링 예산: 반복 리스트 전체에 layout animation을 넣지 않는다. 배치 변경은 CSS를 우선하고 매 viewport pixel resize마다 상태를 갱신하지 않는다. focus 이동은 전환 시 1회 수행한다. graph pan/zoom 데이터 계산 및 채팅 stream rendering은 본 디자인 수정에서 확장하지 않는다. 구체적인 ms/CLS 예산 통과 주장은 실제 측정 전에는 하지 않는다.

## 8. 전체 화면 검증 행렬

공통 차원: light/dark/terminal + system 전환, 375×812, 768×1024, 1024×768, 1440×900, 320×667, 짧은 landscape, 200% zoom, keyboard only, reduced-motion. 모든 조합을 기계적으로 전수 검사했다는 주장은 실제 artifact가 있을 때만 한다.

| 화면/영역 | 필수 시나리오 | 완료 증거 |
|---|---|---|
| Header | 현재 route, 모바일 menu, 검색 shortcut/open/close, theme/language, 긴 admin nav | 각 breakpoint screenshot + aria/focus/44px box 측정 |
| Footer | 긴 주소/이메일, 구독 idle/loading/success/error, 외부 링크 | mobile/desktop screenshot + 입력/피드백 연결 |
| Index | hero 검색/추천/최신글/CTA, loading/empty/failure | 실제 route screenshots 및 핵심 link 동작 |
| Blog | filters/query/pagination, 긴 제목, empty/failure, 필터 열고 resize | query 보존, overflow 없는 화면, keyboard |
| BlogPost와 /post alias | 제목/목차/본문/표/code/image/lightbox/comments/AI actions | reading E2E + 실제 route screenshots. 본문 검증을 전체 앱으로 확대하지 않음 |
| Projects | search/filter/order, empty/error, image 실패/긴 URL | query 및 접근 가능한 link, 카드 배치 |
| About | 프로필/목록/연락처/긴 텍스트 | desktop/mobile layout, mail/social link |
| Debate | 두 입력의 공백/개행, URL topic 진입, 상담 persona 선택, 메시지 입력/오류/닫기 | 입력 보존 테스트 + entry/room screenshot |
| Insight | loading/error/list/map/search/filter, 탐색 선택/보관 선택, inspector, stack, 자체 chat | pane 노출/focus + filter/selection state 보존 |
| Status routes/aliases/* | 각 상태/복구 link, /admin/unknown와 /insight/unknown | 표에 적힌 모든 route가 기대 화면으로 이동 |
| Admin login/callback | session check, gate, TOTP login/setup, invalid code, retry, callback error | auth UI fixture 또는 승인된 session의 screenshot. 정상 인증 성공을 layout으로 추정하지 않음 |
| Admin nav | 9개 section, URL/Back/Forward, mobile select, 마지막 항목, 짧은 높이 | nav overflow/키보드 및 URL 증거 |
| Editor 양쪽 경로 | write/split/preview/tools, resize 시 초안·첨부·AI 상태, metadata, upload error, PR review | pane 폭 실측 + content 보존 + 검토 dialog, 네트워크 제출 없이 검증 |
| Health/RAG/Analytics | loading/empty/error/data/긴 값 및 detail | 섹션별 screenshot/도달 가능한 controls |
| AI 7개 subtab | data form/table/error, Prompt selection/edit, Playground/Trace dialogs | 각 subtab 적어도 mobile+desktop 확인 |
| Env/Secrets/Workers | 긴 값, form, reveal, validation, tabs, dialogs | UI 상태 fixture; 실제 위험 작업 불필요 |
| FAB/visited stack/memo | dock 위치, hide/reveal, 하단 겹침, route suppression | viewport 및 route 이동 후 overlay 잔존 없음 |
| Chat | desktop/expanded/mobile/keyboard viewport, sidebar, attachment/actions, nested confirm | dialog 이름/focus/복귀/스크롤, composer 접근 |
| terminal shells | virtual/real entry, keyboard, suggestions, close, error | 실제 연결 성공 없이도 닫기/focus/viewport 검증 |
| Global loading/error/toast | Suspense, render error fallback, 긴 toast | shell 높이 및 focus 위치/이름 검증 |

## 9. 과거 문서와 이번 증거의 구분

### 현재 작업공간 검증 상태

위 행렬의 필수 시나리오는 계획이며 모두 통과한 목록이 아니다. 후속 실행의 실제 근거는 `workspaces.md`와 연결된 JSON/스크린샷에 있다.

| 행렬 영역 | 실제 확보한 증거 | 남은 범위/해석 |
|---|---|---|
| Admin nav | 짧은1280×420 nav3테마, Prompts 직접 진입/방향키/resize3사례 | 전체9section 기본 경로는 아래 실제 render로 확인; 모든 Back/Forward 조합 전수 아님 |
| Editor 양쪽 경로 | 375–1920px6폭×3테마×2경로36사례, pane 노출과 resize 내용 보존 | 첨부/제출/PR review는 이 harness 범위 밖 |
| Prompts/Logs | 320–1440px5폭×3테마×2화면30사례, label/선택/검색/일시정지 | 실제 저장/stream server 연결을 주장하지 않음 |
| Health/RAG/Analytics | 320/1440px light/terminal에서 오류 및 사용 가능한 fallback | 성공 health/검색/analytics chart 데이터 상태는 확인하지 않음 |
| AI7개 subtab | 기존 Prompts + 나머지6개 실제 render, 모델/provider/route/trace 빈 목록과 오류 | Playground 내부 History/Templates, 생성/수정/detail dialog, 사용량 성공 chart는 제외 |
| Env/Secrets/Workers/Content | 설정 읽기 전용, Secrets overview/audit 빈 상태, Workers3subtab 빈 상태, CTA 오류/default preview | Secrets 목록은 `Invalid admin API URL` 오류로 성공 빈 목록 미확인; 값이 채워진 폼/저장/위험 작업 제외 |

추가 관리자17경로×2폭×2테마×2fixture mode의136사례는 `admin-coverage/results.json`에 있다. `empty-known`은 schema를 확인한 API만 빈 fixture로 응답하고 나머지는503을 유지한다. 최종136사례의 document/조작 영역 넘침, 이름 없는 입력, 지역 scroll 밖 콘텐츠 넘침, pageerror는0이다. 합계는 기존39+30+subtab3+추가136=208사례다. 재측정한80개 행은 최종136개 안에 포함되며 중복 계산하지 않는다. 인증이나 서버 저장은 이 디자인 검증의 완료 조건으로 추가하지 않는다.

후속 시각 검토에서 Playground의 비어 있던 Models 패널에 loading/error/empty 안내와 재시도를 추가하고, 모델 checkbox 이름/키보드 선택을 연결했다. `playground-models/results.json`의320px light/terminal×4상태8사례와 단위8/8 통과를 추가했다. 현재 담당 브라우저 합계는216사례이며, 기존136개의 Playground8행을 최종 소스로 교체한 재검사는 중복 계산하지 않는다. 상세 변경/한계는 `workspaces.md`의 마지막 절을 따른다.

10개 후속 admin feature의 기존 단위 suite는40통과/8실패이며, 이10파일의 변경 전 HEAD 본문으로 대조해도 같은8개가 실패했다. `admin-coverage/unit-baseline-comparison.json`을 근거로 디자인 변경의 회귀와 기존 검증 실패를 구분한다.

`docs/reading-ux-20260908/REPORT.md:46–62`는 CSS 독립 HTML/원본 검사와 당시 실행하지 못한 통합 검증을 명시적으로 구분한다. 이 문서를 근거로 현재 앱의 전체 디자인 완료를 선언하지 않는다.

`LOCAL_INTEGRATION.md:34`에는 legacy 전체 Vitest가 메모리 압력으로 중단되었고 bounded editor test가 실패했다고 적혀 있다. 이번 작업에서 다시 실행한 명령/실패/통과 범위를 별도 결과 문서에 기록해야 한다. 타입 검사나 build 통과는 화면 디자인과 modal focus 증거를 대체하지 않는다.

완료 기준은 전체 경로, 공통 shell, 작업공간, overlay의 필요한 상태를 실제로 확인하고 위 확정 결함을 해결하는 것이다. 분석 문서 작성이나 일부 공개 페이지의 screenshot만으로 전체 디자인 목표를 완료 처리하지 않는다.
