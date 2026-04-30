# 블로그 TOC Option A 적용 계획

## 목표

전역 최상단 헤더는 그대로 유지하고, 블로그 상세 페이지의 목차만 Option A의 `Sticky Outline Sidebar` 형태로 정리한다. 단, 진행률 또는 process indicator는 기존 전역 `ReadingProgress`를 그대로 사용하며 새 진행률 UI는 추가하지 않는다.

## 변경 범위

### 변경 대상

- `frontend/src/pages/public/BlogPost.tsx`
- `frontend/src/components/features/blog/TableOfContents.tsx`
- 필요 시 TOC/BlogPost 관련 테스트 파일

### 변경 금지 대상

- `frontend/src/App.tsx`
- `frontend/src/components/organisms/Header.tsx`
- `frontend/src/components/features/search/HeaderSearchBar.tsx`
- `frontend/src/components/molecules/NavigationItem.tsx`
- `frontend/src/components/common/ReadingProgress.tsx`

## Process Indicator 결정

| 영역 | 상태 | 해석 |
|---|---:|---|
| 기존 상단 진행률 | 변경 사항 없음 | `ReadingProgress`를 그대로 유지한다. |
| TOC 내부 진행률 bar/percent | 적용 제외 | Option A 이미지의 TOC 내부 진행률 UI는 구현하지 않는다. |
| 진행률 계산 로직 | 변경 사항 없음 | scroll progress source를 하나로 유지한다. |
| 리스크 상태 | 해소 | 중복 progress, 서로 다른 scroll 기준, 표시 불일치 리스크를 제거한다. |

## 확인된 사실

- 전역 헤더는 `App.tsx`에서 라우트 바깥의 `<Header />`로 렌더링된다.
- 전역 헤더는 sticky top header이며 높이는 `h-16`이다.
- 블로그 상세 페이지는 `BlogPost.tsx`에서 page grid를 구성한다.
- 현재 TOC는 데스크톱에서 좌측 aside에 배치되어 있다.
- 현재 2xl 우측 column은 빈 aside로 남아 있다.
- `ReadingProgress`는 이미 블로그 상세 페이지 상단에 렌더링된다.
- `TableOfContents.tsx`는 markdown content를 기반으로 TOC 항목을 생성한다.
- 현재 TOC observer effect는 `isMobile`만 dependency로 가진다.
- 실제 본문 렌더 source는 `contentForRender`이고, 현재 TOC source는 `tocContent`다.
- 모바일 TOC drawer의 heading 존재 판단은 단순 regex이며, 데스크톱 TOC의 `buildMarkdownToc` 기준과 다르다.

## 상태 전이별 리스크 분석

| 상태 변화 | 리스크 | 상태 해석 | 대응 전략 |
|---|---|---|---|
| `loading -> post loaded -> Markdown Suspense resolved` | TOC active tracking 누락 | TOC effect가 heading DOM 생성 전에 실행되면 observer 대상이 비어 있다. 이후 Markdown이 lazy 렌더되어 heading이 생겨도 active section이 갱신되지 않을 수 있다. | `content` 또는 생성된 `toc` 변경 시 observer를 재등록한다. 필요하면 `[data-toc-boundary]`에 `MutationObserver`를 붙여 heading 등장 후 observe한다. |
| `post A -> post B` | 이전 글의 `activeId` 또는 heading ref 잔존 | 라우트는 바뀌었는데 이전 글 heading id가 active 상태로 남으면 TOC 강조가 틀어진다. | `content` 변경 시 `activeId`, `itemRefs`, observed headings를 초기화한다. |
| `original content -> translated content` | TOC와 본문 불일치 | 번역이 ready 상태가 되면 본문 heading text/id가 바뀔 수 있다. TOC가 이전 content 기준이면 클릭 대상과 표시 항목이 어긋난다. | TOC source를 실제 렌더 source인 `contentForRender` 기준으로 통일한다. |
| `autoSimulatorSrc: null -> exists` | 자동 삽입 heading 누락 | `contentForRender`는 simulator heading을 추가할 수 있지만, TOC가 원본 content를 보면 해당 heading이 빠진다. | TOC와 관련 패널 입력을 최종 렌더 content와 일치시킨다. |
| `desktop scroll idle -> scrolling -> stopped` | active item이 늦거나 잘못 갱신 | IntersectionObserver root margin, sticky top, click scroll offset이 서로 다른 값이면 빠른 스크롤 또는 긴 섹션에서 현재 위치 판단이 흔들린다. | sticky offset을 단일 상수 또는 CSS variable로 통합하고 observer root margin과 click offset을 같은 기준으로 맞춘다. |
| `not stuck -> stuck` | TOC가 전역 헤더와 겹침 | 전역 Header는 sticky이고 TOC도 sticky다. offset 값이 분산되어 있으면 유지보수 중 헤더 아래에 TOC가 숨어 보일 수 있다. | `TOC_STICKY_TOP_PX` 같은 단일 source를 사용한다. class, scroll 계산, heading scroll margin 정책을 함께 맞춘다. |
| `mobile -> desktop` resize | drawer 상태와 desktop TOC 상태 충돌 | 모바일 drawer가 열린 상태에서 desktop으로 전환되면 drawer 내부 open state가 남을 수 있다. | desktop breakpoint에서는 drawer를 렌더하지 않거나, breakpoint 전환 시 drawer를 close한다. |
| `desktop -> mobile` resize | desktop observer 불필요 동작 | mobile에서는 drawer 중심으로 동작해야 하는데 desktop observer가 남아 있으면 불필요한 state update가 생길 수 있다. | `isMobile` 전환 cleanup에서 observer disconnect와 pending animation frame cleanup을 보장한다. |
| `normal theme -> terminal theme` | TOC 줄바꿈/indent/active 색상 회귀 | terminal mode는 font, spacing, 색상, 항목 번호 표현이 다르다. 일반 모드 스타일만 맞추면 terminal에서 항목 폭과 line-height가 깨질 수 있다. | 기존 `isTerminal` 분기를 유지하고, Option A 스타일은 non-terminal 중심으로 적용하되 terminal fallback을 보존한다. |
| `external memo float -> rail` | 우측 TOC와 외부 rail 충돌 | `BlogPost.tsx`는 `aiMemo:desktopLayout` rail 이벤트를 보낸다. repo 내부 listener는 없지만 외부 web component가 우측 rail을 차지할 수 있다. | 실제 화면에서 우측 rail 충돌을 확인한다. 충돌 시 TOC column 폭 조정, memo rail float 유지, 또는 2xl 전용 여백을 별도로 설계한다. |
| `TOC item click -> smooth scroll` | heading 도착 지점이 header 아래에 숨음 | click scroll offset과 heading `scroll-mt-*`가 따로 관리되면 클릭 후 heading이 sticky header 아래로 가려질 수 있다. | scroll offset, `scroll-mt-*`, sticky top 값을 같은 정책으로 맞춘다. |
| `no headings -> headings exist` | 모바일 TOC 버튼 노출 판단 불일치 | drawer는 regex, desktop TOC는 `buildMarkdownToc` 기준이면 같은 content에서도 표시 여부가 달라질 수 있다. | drawer도 `buildMarkdownToc(content, postTitle).length > 0` 기준으로 통일한다. |

## 금지해야 할 상태 전이

| 금지 전이 | 이유 | 검출 방법 |
|---|---|---|
| `Header unchanged -> Header modified` | 사용자 요구사항 위반 | `git diff -- frontend/src/App.tsx frontend/src/components/organisms/Header.tsx`가 비어 있어야 한다. |
| `single progress source -> duplicated progress source` | progress 표시 불일치와 계산 중복 발생 | TOC 내부 progress UI 또는 별도 scroll progress state가 추가되지 않아야 한다. |
| `rendered content changed -> TOC unchanged` | 번역, simulator, route change 후 TOC가 본문과 달라진다. | route/content 변경 테스트에서 TOC 항목과 heading id를 비교한다. |
| `headings rendered -> observer absent` | active section 기능이 시각적으로만 존재하게 된다. | Markdown lazy render 이후 active item이 잡히는지 테스트한다. |
| `mobile drawer visible + desktop sidebar visible` | breakpoint 전환 시 중복 목차 UI가 생긴다. | mobile/desktop viewport 테스트로 확인한다. |

## 실행 단계

### Phase 0. Scope Lock

Entry criteria:

- Option A 적용 범위가 TOC로 한정되어 있다.
- 진행률 UI는 기존 `ReadingProgress` 유지로 결정되어 있다.

Exit criteria:

- 전역 Header 관련 파일은 변경 금지 목록에 포함된다.
- `ReadingProgress`는 변경 금지 목록에 포함된다.

### Phase 1. TOC 데이터 source 정리

Entry criteria:

- `BlogPost.tsx`에서 실제 본문 렌더 source와 TOC source 위치를 확인했다.

Exit criteria:

- TOC가 `contentForRender` 기준으로 생성된다.
- 번역 content와 자동 삽입 simulator content가 TOC에 반영될 수 있다.

### Phase 2. TOC observer 상태 전이 보강

Entry criteria:

- TOC 항목 생성 source가 확정되었다.

Exit criteria:

- route/content 변경 시 `activeId`와 item refs가 초기화된다.
- Markdown lazy render 이후 heading observer가 정상 등록된다.
- cleanup에서 observer, resize observer, raf, timeout이 정리된다.

### Phase 3. Option A 레이아웃 적용

Entry criteria:

- active tracking과 content source가 안정화되었다.

Exit criteria:

- 데스크톱에서 TOC가 본문 옆 sticky sidebar로 보인다.
- 모바일에서는 기존 drawer 중심 동작을 유지한다.
- 전역 Header와 ReadingProgress는 변경되지 않는다.

### Phase 4. 접근성 및 반응형 검증

Entry criteria:

- Option A 레이아웃이 적용되었다.

Exit criteria:

- TOC nav에 명확한 `aria-label`이 있다.
- active TOC item에 `aria-current`가 있다.
- 긴 heading text가 sidebar 밖으로 넘치지 않는다.
- terminal theme에서 기존 fallback이 유지된다.

### Phase 5. 테스트 및 검증

Entry criteria:

- 구현 patch가 완료되었다.

Exit criteria:

- `npm run lint`
- `npm run type-check`
- `npm run test:run`
- 필요 시 `npm run build`
- desktop/mobile viewport 수동 또는 Playwright 확인

## 위임 계획

| 단계 | 담당 에이전트 | 산출물 |
|---|---|---|
| 탐색 | `explore` | 파일/라인 기반 현재 구조 리포트 |
| 설계 | `code-architect` | TOC 배치, offset 정책, responsive 정책 ADR |
| 구현 총괄 | `sisyphus` | 단계별 실행 및 검증 조율 |
| TOC 동작 구현 | `opencode-builder` | `TableOfContents.tsx` patch |
| BlogPost 배치 구현 | `opencode-builder` | `BlogPost.tsx` patch |
| 테스트 | `tester` | TOC/BlogPost 관련 테스트 추가 또는 갱신 |
| 리뷰 | `code-reviewer` | Header 변경 여부, state transition, 접근성 리뷰 |
| 검증 | `verifier` | 명령 실행 결과와 변경 범위 검증표 |

## Handoff Contracts

### Explore -> Code Architect

Markdown report:

- `Files inspected`
- `Current layout`
- `Current TOC state owners`
- `Content source mapping`
- `Known risks`
- `Do-not-touch files`

### Code Architect -> Sisyphus

ADR:

- `Target layout`
- `Sticky offset policy`
- `Progress indicator policy`
- `Responsive policy`
- `Theme policy`
- `Allowed files`
- `Forbidden files`

### Sisyphus -> Builder

Implementation brief:

- `Task`
- `Files allowed`
- `Expected behavior`
- `State transitions to preserve`
- `Verification commands`

### Builder -> Tester

Patch summary:

- `Changed files`
- `Behavior changes`
- `State transitions affected`
- `Manual checks performed`

### Tester -> Reviewer

Test report:

- `Test files`
- `Invariants covered`
- `Commands run`
- `Known gaps`

## 최종 검증 체크리스트

- [ ] `App.tsx` 변경 없음
- [ ] `Header.tsx` 변경 없음
- [ ] `ReadingProgress.tsx` 변경 없음
- [ ] TOC 내부 progress UI 없음
- [ ] TOC와 본문 content source 일치
- [ ] route/content 변경 시 TOC state 초기화
- [ ] Markdown lazy render 이후 observer 등록
- [ ] desktop TOC는 sticky sidebar
- [ ] mobile은 drawer 유지
- [ ] active item 접근성 속성 존재
- [ ] 긴 heading 줄바꿈 정상
- [ ] terminal theme 회귀 없음
- [ ] lint/type/test 통과

