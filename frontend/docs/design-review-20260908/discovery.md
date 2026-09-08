# 홈·게시글 탐색 디자인 점검 및 개선 — 2026-09-08

## 범위와 구현 계약

`Index.tsx`, `Blog.tsx`, 홈 섹션, `SearchBar`, 공통 `Pagination`, `ui-home.css`를 다뤘다. 기존 홈의 제목 → 검색 → 추천 → 최신 글 → 주제 → 안내 구조와 블로그의 편집형 첫 페이지를 유지했다. 공유 테마 토큰을 사용하고 새로운 서비스, 데이터, 의존성은 추가하지 않았다. `frontend-designer` 지침을 적용했고 shadcn `ui/`, 생성 manifests, 공통 토큰/레이아웃 CSS는 이 담당 작업에서 수정하지 않았다.

## 발견과 처리

| 문제 | 확인 근거 | 개선 |
|---|---|---|
| 홈 검색 중 반복 렌더 위험 | Index가 매 렌더마다 새 `onSearchResults` 콜백을 전달하고 SearchBar effect가 콜백에 의존하며 새 결과 배열을 다시 전달 | 콜백을 `useCallback`으로 고정. 실제 SearchBar를 포함한 통합 테스트에서 검색·해제 확인 |
| 검색 데이터 로딩/실패가 결과 없음으로 보임 | 검색 시작 전에 loaded=true, catch가 빈 채로 종료 | pending promise 중복 방지, idle/loading/ready/error 구분, 오류 시 다시 시도 |
| 검색 결과 수를 9개로 잘라 전체 개수를 오인 | sanitization 전 `slice(0,9)` | 전체 안전한 결과 수를 세고 9개만 미리보기. 검색어를 보존하는 `/blog?q=...` 전체 결과 링크 |
| 홈 태그 링크가 필터로 작동하지 않음 | 홈은 `?tag=...`, Blog는 category/page만 읽음 | 반복 `tag`, `q`, `sort`, `category`, `page`를 URL 상태로 통합 |
| 후반 페이지에서 필터 변경 시 잘못된 빈 결과 | 태그/검색 핸들러가 currentPage를 유지 | 필터/정렬 변경마다 page 제거. 조회는 debounce가 끝난 검색어로만 수행 |
| 뒤로가기와 화면 필터 불일치 | URL과 로컬 category/page의 이중 상태, 태그/검색은 로컬만 존재 | URL을 단일 상태 원천으로 사용, 실제 history 회귀 검사 |
| 잘못된 page 문자열이 NaN으로 전달될 수 있음 | 기존 동기화 effect의 Math.max(1, parseInt(...)) | 양의 safe integer만 허용, 나머지는 첫 페이지 |
| 6번째 이후 주제에 접근할 수 없음 | categories.slice(0,5) 버튼만 존재 | 자주 보이는 5개 버튼 유지, 모든 주제 native select 추가 |
| 정렬 state는 있으나 사용자 조작 수단 없음 | sortBy 선언/요청만 존재 | 최신/제목/짧은 글 순 select |
| 태그 선택 상태와 제거 동작이 불명확 | 버튼 선택 의미/해제 accessible name 없음 | aria-pressed, 선택 태그 제거명, 전체 해제, 확장 영역 aria-controls |
| 1~3개 결과에서 같은 글이 두 번 보임 | featured/spotlight 뒤 list fallback으로 pageData.items 재출력 | 첫 unfiltered 최신순 페이지만 편집형. 검색/필터는 단일 목록, 각 글 한 번 |
| 오류 후 전체 새로고침으로 검색 문맥을 잃음 | window.location.reload 재시도 | 현재 URL 필터를 보존한 read 재시도, metadata 오류도 분리 안내 |
| 실제 결과 상태보다 먼저 숫자/페이지 버튼 노출 | 로딩 중 이전 pageData 기준 pagination | pending/오류 동안 pagination을 숨기고 결과 수 live 상태 제공 |
| 소형 clear/jump 버튼과 모바일 pagination 넘침 | SearchBar 28px, 태그 clear32px; root의 320px 실측 pagination overflow | clear/태그/jump/nav 44px. 좁은 화면은 현재/전체+첫/이전/다음/마지막, 필요 시 wrap |
| quick jump가 두 영역 동시 열림 및 타이핑 초점 손실 | 모든 ellipsis가 같은 boolean, 내부 컴포넌트 정의가 재렌더마다 재생성 | 활성 위치 1개만 저장하고 렌더 함수로 DOM identity 보존. 초점 유지 회귀 검사 |
| 로딩 시 홈 글 자리 확보 부족 | 추천/최신 loading이 단문 상태만 출력 | 행 구조를 닮은 정적 skeleton, lead 별도 높이. 정확한 zero CLS를 주장하지 않음 |
| 빈 주제 데이터에 가짜 0개 주제가 표시됨 | Index의 6개 fallbackEntries | 실제 집계만 표시하고 기존 empty/error 상태 사용 |
| 추천 데이터 모두 실패해도 준비 중으로 보임 | 최종 fallback 오류 후 빈 배열을 ready로 전달 | 추천 error 상태와 재시도 제공; 늦게 완료된 모든 추천 응답 취소 가드 |
| 일반 사용자에게 내부 analytics 장애 설명 노출 | Analytics picks unavailable 등 | 준비된 글/최신 글 사용 여부를 일반 언어로 설명 |

## 시각·접근성 결정

- 색상, 글꼴, 테두리, focus는 `--ui-*` 토큰 사용. 전용 토큰은 최소 조작 크기 44px와 본문 줄높이 1.8만 추가했다.
- 홈 링크에 키보드 focus outline과 눌림 opacity, 긴 주제/제목/검색어 줄바꿈을 적용했다. 최신 글 설명은 2줄로 제한해 목록 스캔을 쉽게 했다.
- skeleton은 실제 데이터를 만들지 않으며 `aria-hidden`이고 별도 loading 상태가 읽힌다. 동작 완료로 오인할 영구적인 Searching 문구와 검색 결과 pulse를 제거했다.
- 추가 pagination 애니메이션은 `motion-safe:transition-transform` 및 `motion-safe:active`만 사용한다. 홈은 기존 reduced-motion 차단 규칙을 유지하며 페이지 이동 scroll도 사용자 설정을 따른다.
- 상태 범위: 기본/hover/pressed/focus, 로딩/빈 결과/오류/재시도, pagination disabled, 선택된 필터, 닫힘/열림 태그와 quick jump. 검색 데이터를 성공했다고 추정하는 UI를 제거했다.

## 검증

- 10개 기존·신규 파일: **27/27 통과**. 홈 섹션, Index 기존 sanitization, 실제 SearchBar, Blog URL/state, Pagination 포함.
- 최종 추가 변경(검색 debounce 중간 상태, 추천 오류, pagination 초점) 후 해당 3개 파일 **12/12 통과**. 합집합은 28개 테스트이며 마지막 명령은 전체 28개를 재실행한 것이 아니다.
- `Index.search.test.tsx`: 실제 SearchBar를 포함해 검색 안정화/9개 미리보기/전체 결과 링크/clear, loading과 failure가 빈 결과로 표시되지 않음, 재시도 성공을 검증.
- `Blog.discovery.test.tsx`: 유입 q/tag, 페이지 초기화와 category 유지, tag/category/sort/history, 잘못된 page, 중복 없는 작은 목록, 필터 유지 재시도 5개를 검증.
- `Pagination.test.tsx`: 기존 경계/정상 이동 4개 + 2개 ellipsis 중 하나만 열리고 입력 DOM과 focus가 유지되는 회귀 1개.
- 기존 SearchBar 테스트 2개는 frozen timers와 waitFor 조합으로 timeout이었다. `await act`로 실제 promise 완료를 기다리고 서비스 인자/결과 콜백을 직접 확인하도록 수정했다.
- 담당 source/test ESLint: **0 errors**, 기존 exported normalizer에 대한 fast-refresh 경고 3개.
- 첫 type-check 통과. 최종 통합 실행에서 다른 담당자의 `scripts/design-verification/workspace-harness.tsx`가 Node tsconfig에 포함되어 JSX/DOM 설정 오류가 발생해 root에 전달했다. 최종 통합 type-check 결과는 root 보고서를 따른다.
- `git diff --check` 담당 파일 통과.
- `npm run korean:scan`: 기존 `public/posts/2024/queue.md` emoji의 zero-width 문자 1건만 보고. 이 명령은 public/posts를 검사하므로 TSX 문구 검증을 뜻하지 않는다.

## 계약 amendment와 후속 확인

`discovery-contract-amendments.json`에 Index lifecycle 1개와 Index/Blog 선언 26개의 기존 before, 새 after, 구체 변경 이유, 관련 테스트를 기록했다. 기존 기준 해시는 변경하지 않았으며 root가 기존 명시 amendment 경로에 병합한다. Blog effect 개수는 줄었지만 해당 effect는 lifecycle baseline 대상이 아니므로 checker 확장은 필요 없다.

브라우저 시각 검증은 root가 로컬 Chromium에서 수행한다. 특히 320px pagination 수정 후 가로폭, 모바일 태그 sheet의 긴 텍스트/전체 주제 select, 세 테마 focus와 대비, 지연·실패 데이터 상태를 최종 확인해야 한다. 외부 API의 실제 가용성/구독/전송은 이 범위에서 검증하거나 실행하지 않았다. 홈과 전체 목록은 기존 검색 엔진이 달라 fuzzy match 개수가 정확히 같다는 보장은 하지 않는다. full CLS/INP 측정은 수행하지 않았으며 skeleton만으로 성능 지표 통과를 주장하지 않는다.

## 공통 디자인 변경 독립 리뷰

root의 공통 diff를 추가로 읽고 아래 두 항목을 전달했다. 공통 파일은 직접 수정하지 않았다.

1. **확인된 hover 대비 문제 → 수정:** `index.css`의 `:root:not(.dark):not(.terminal) button:hover`가 `.ui-primary-button` 배경보다 우선했다. Chromium 390px `/blog` 필터 sheet의 `결과 보기`에서 기본 `rgb(36,86,188)`/흰 글자가 hover 시 `rgb(237,243,255)`/흰 글자로 바뀜을 측정했다. root가 전역 규칙을 낮은 specificity의 `:where`로 바꿨고 세 테마의 primary hover 색 보존을 브라우저에서 확인했다.
2. **메모 close 초점 복원 부족 → 수정:** 기존 minimize/close/Escape는 `.open` 제거와 updateOpen만 수행했다. root가 open 시점의 연결된 발신 요소를 저장하고 close 시 복원하며, 없어졌으면 main-content로 돌아가게 수정했다. 닫힌 패널 `display:none`은 mobile `.panel{display:flex}`보다 specificity가 높아 정상 작동한다. 실제 메모 발신 버튼 복원·경로 이동 후 닫힘 유지 시나리오는 root의 site-design E2E에 있다.

Theme/Language의 `menuitemradio`, route fallback의 실제 loading label, ease 토큰 추가에서 추가적인 동작 차단은 발견하지 못했다. 세 테마의 전체 대비가 검증되었다는 의미는 아니며, 최종 브라우저 결과를 따른다.

최종 독립 검수에서 터미널 헤더 검색 input이 390px에서 12.25px로 렌더되는 점과, 검색 시트의 첫 focusable인 `grep` 버튼으로 초점이 가는 점을 재현했다. root가 모바일 검색 시트 input을 16px로 정하고 시트가 열릴 때 실제 검색 input에 초점을 주도록 수정했다. 별도로 manifest 실패가 페이지의 오류 경계에 도달하지 않는 문제를 실제 요청 차단으로 확인하고 수정했으며, 자세한 동작·호환 계약·회귀 증거는 `discovery-failure.md`를 따른다. 이 최종 단계의 6개 파일 20개 단위 테스트, 전체 type-check와 148개 guard가 통과했다.
