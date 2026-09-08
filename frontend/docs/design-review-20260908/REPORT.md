# 전체 디자인 분석과 개선 — 2026-09-08

공개 페이지, 읽기 화면, 관리자 작업공간과 플로팅 도구를 실제 코드와 브라우저로 조사하고 개선했다. 기존 세 테마와 정보 구조를 유지하면서 탐색, 입력, 반응형 배치, 상태 안내, 키보드 조작에서 확인된 결함을 수정했다. 이 문서는 현재 로컬 변경의 통합 보고서다.

## 핵심 결과

| 문제 | 사용자에게 나타난 결과 | 수정과 확인 |
| --- | --- | --- |
| 모바일 메모의 닫힘 상태와 CSS 불일치 | `isOpen=false`인데도 패널이 화면을 덮었다. | `.panel:not(.open)`을 숨기고 열기·닫기 전환에 초점 복귀를 연결했다. 실제 320px에서 최초 닫힘, 명시적 열기, 닫기, 다른 페이지 이동과 원래 버튼 복귀를 확인했다. |
| 주요 버튼의 테마별 CSS 충돌 | terminal의 밝은 민트 버튼에 밝은 글자가 표시되고 light hover가 primary 배경을 덮었다. 같은 변형의 링크도 전역 terminal 링크 색에 덮였다. | 부분 문자열 `outline` 선택자가 `focus-visible:outline-none`에도 매칭되던 문제를 고쳤다. 전역 hover 우선순위와 링크 예외를 정리하고 실제 변형 클래스·토큰을 사용한다. 세 테마의 primary 버튼과 링크 기본/hover 대비를 검증했다. |
| 작은 모바일 탐색 버튼 | `h-11`이 모바일 root 14px에서 38.5px로 계산됐다. | 페이지 이동 조작은 명시적 최소 44px로 지정했다. 320px에서도 첫/이전/현재·전체/다음/마지막 버튼이 화면 안에 들어간다. Header·Footer 주요 탐색도 실제 경계 상자로 검증했다. |
| 홈 검색과 목록 URL 불일치 | 검색 콜백 반복, 로딩을 빈 결과로 오인, 홈 태그 링크 무효, 뒤로가기 시 필터 불일치가 있었다. | 로딩·오류·다시 시도를 분리하고 URL을 검색/태그/주제/정렬/페이지의 단일 상태로 사용한다. 필터 변경은 첫 페이지로 이동한다. 9개 검색 미리보기에는 전체 결과 링크를 제공한다. |
| 데이터 실패가 성공한 빈 목록으로 캐시됨 | 실제 manifest 503에도 “찾는 글이 없습니다”가 표시되고 다시 시도가 없었다. | HTTP·네트워크·JSON 실패를 빈 캐시에 저장하지 않는다. 홈과 목록만 명시적으로 오류를 전달받으며 기존 다른 호출의 fallback과 유효한 빈 목록을 보존한다. 실제 서비스의 실패→성공 복구를 검사했다. |
| 입력 중 내용 훼손 | 주제를 입력할 때 공백과 문단 끝 줄바꿈이 즉시 제거됐다. | 편집 중 원문을 유지하고 시작 시 정규화한다. 모바일 맥락 입력 높이를 200px 이상으로 확보했다. |
| 저장·전송 상태의 불명확함 | 문의 결과가 toast에만 남고 입력 변경/재시도 맥락이 약했다. | 문의와 구독에 지속되는 성공·실패 설명, 실패 시 내용 보존, 중복 제출 방지와 재시도 경로를 적용했다. 요청은 mock으로 검증했다. |
| 중첩 관리자 편집기 압축 | 사이드바가 있는 중간 화면에서 작성/미리보기/도구가 지나치게 좁아졌다. | editor 자신의 가용 폭을 기준으로 pane을 전환한다. 동일 문서와 도구 상태를 유지하며 resize 후 내용 보존을 확인했다. |
| 작업공간에서 조작 위치 유실 | 짧은 관리자 화면의 마지막 메뉴, 오른쪽 AI 탭, 모바일 Insight 선택 결과에 접근하기 어려웠다. | 사이드바 내부 스크롤, 선택 탭만 가로 노출, 보관 항목 선택 시 inspector 표시·초점 이동을 적용했다. |
| 관리자 도구행과 입력 이름 누락 | Providers 추가 버튼과 Config 상태가 320px 밖으로 나갔다. Secrets 검색은 44px 폭으로 압축됐고 일부 RAG·AI 입력에 연결된 이름이 없었다. | 해당 사용부의 도구행을 줄바꿈하고 검색 영역의 가용 폭을 확보했다. Playground의 보이는 label을 입력에 연결하고 다른 검색에도 이름을 부여했다. 17개 추가 화면의 오류·빈 상태를 확인했다. |
| 채팅·터미널의 선언뿐인 dialog | fullscreen 화면에 dialog 역할은 있으나 Tab 경계와 닫기 후 복귀가 없었다. | 기존 Radix의 중첩 레이어와 초점 관리에 연결했다. FAB 버튼이 제거됐다 다시 생기는 경우에도 해당 조작으로 돌아간다. xterm의 Escape 입력 의미는 보존했다. |
| 닫은 명령어 제안이 다시 열림 | 같은 입력에서 부모가 다시 렌더링하면 제안이 복원돼 Escape로 창을 닫기 어려웠다. | 사용자가 닫거나 선택한 현재 입력의 제안을 유지해 숨긴다. 입력을 수정하면 다시 제안하고, 다음 Escape는 기존 창 닫기 동작으로 전달한다. |
| 터미널 단축키와 검색 초기 초점 | Ctrl+Alt+M이 메모의 Alt+M 조건에도 매칭돼 채팅 위에 메모가 열렸다. 헤더 검색은 입력 대신 grep 버튼에 초점이 갔다. | 메모는 정확한 Alt+M만 처리한다. 검색 Sheet는 실제 입력에 초기 초점을 둔다. 단축키 후 숨은 메모 여부와 채팅 버튼의 실제 클릭 가능성까지 확인했다. |
| Playground의 빈 모델 패널 | 0/5 selected 아래에 설명 없는 빈 200px 영역만 보였다. | 로딩·실패/재시도·사용 가능한 모델 없음·실제 목록을 구분한다. 모델 체크박스에 모델명/제공자 이름을 연결하고 Space 선택을 지원한다. |
| 프로젝트 필터와 플로팅 도구 겹침 | 1440px에서 첫 필터의 왼쪽 일부를 누르면 Visited Stack으로 전달됐다. | 데스크톱 도구가 나타나는 768px 이상에서 프로젝트 콘텐츠 여백을 72px로 확보했다. 모바일은 기존 배치를 유지한다. |

## 디자인 결정

- **위계와 가독성:** 홈의 검색→추천→최신→주제 흐름을 유지하고, 소개는 프로필→기술→문의의 제목 구조와 바로가기를 정리했다. 프로젝트는 탐색·정렬·결과 수·표시 방식·카드 액션의 역할을 분명히 했다. 긴 제목과 설명은 줄바꿈하고 장식 아이콘은 낭독에서 제외한다.
- **테마와 상태:** 기존 `--ui-*` 팔레트를 공유한다. light 입력 테두리의 대비를 높이고, 선택 상태는 색 외에 `aria-pressed` 또는 `aria-checked`로 표현한다. 테마와 언어 메뉴는 실제 단일 선택 항목으로 읽힌다.
- **반응형:** 공개 문서는 자연스럽게 세로로 흐른다. 편집기와 Inspector는 자신의 pane 경계를 사용한다. 모바일 페이지 이동은 필요한 조작을 압축해 보여주되 터치 영역을 축소하지 않는다.
- **피드백:** 검색의 loading/empty/error를 구분하고 조회 실패의 재시도는 현재 필터를 유지한다. 프로젝트와 홈의 skeleton은 실제 행·카드 공간을 예약하며 가짜 콘텐츠나 가짜 통계를 표시하지 않는다.
- **키보드와 모션:** 가시적인 focus, 중첩 팝업의 Escape 소유권, 닫기 후 복귀를 함께 다뤘다. 추가된 움직임은 transform/opacity 위주이며 reduced-motion을 존중한다.
- **구조 보존:** 기존 route, auth, domain service 경계와 상태 소유권을 유지한다. 재시도를 위한 게시글 실패 전달은 기존 service와 adapter에서 처리한다. `src/components/ui/` 관리 파일과 의존성을 변경하지 않았다. 테스트용 관리자 harness는 프로덕션 인증 우회 경로로 등록되지 않는다.

## 실측

| 항목 | 개선 전 | 개선 후 |
| --- | --- | --- |
| terminal 관리자 제출 버튼 글자/배경 대비 | 1.33:1 (`rgb(229,241,233)` / `rgb(141,226,177)`) | 10.48:1 (`rgb(16,37,26)` / 동일 배경) |
| light 강한 입력 테두리 / 흰색 표면 | 약 2.93:1 | 약 3.55:1 |
| light 강한 입력 테두리 / canvas | 약 2.76:1 | 약 3.35:1 |
| 320px 페이지 이동 버튼 | 38.5px 높이·너비 | 최소 44px, 가로 경계 안에 표시 |
| 관리자 1024px 편집 | 코드상 split 약 215px씩 예상 | compact 작성 703px 실측 |
| 관리자 1280px 편집 | viewport만으로 split 전환 | compact 작성 935px 실측 |
| 관리자 1440px 편집 | — | 작성 377px / 미리보기 377px / 도구 334px |
| 독립 편집기 1280px | — | 작성 428px / 미리보기 428px / 도구 310px |
| 짧은 관리자 1280×420 | 마지막 메뉴 도달 위험 | 탐색 높이 356px / 내용 631px, Workers 키보드 도달 |

수치는 해당 Chromium의 CSS pixel 기준이다. 편집기 개선 전 값은 구조로 계산한 추정이며 개선 후 수치는 실제 렌더링 측정이다. 모든 글자와 상태의 접근성 적합성 또는 실기기 성능을 이 표로 일반화하지 않는다.

## 검증 결과

| 검증 | 현재 결과 | 범위 |
| --- | --- | --- |
| 공개·공통·데이터 회귀 | 47개 파일 / 190개 통과 | 공통 메뉴·Footer·Debate, 읽기·배포 smoke, 홈·목록·검색·프로젝트·문의, 실제 manifest 실패 복구, 관리자 탐색·Insight·Prompts |
| 채팅·터미널·FAB 회귀 | 16개 파일 / 53개 통과 | 실제 Radix 초점, 하위 창, trigger 재마운트·route 이동, Shell 제안 닫힘·Tab 선택 |
| Playground 후속 회귀 | 8/8 통과 | 로딩→빈 목록, 오류/재시도, 모델 checkbox 이름·Space·label 선택, 기존 실행 payload/5개 제한 |
| 원본 계약 보존 | 148/148 통과 | 원래 baseline은 유지하고 의도된 동작 변경만 이유·테스트를 명시한 amendment로 검증 |
| 공개 앱·읽기 Chromium | 38/38 통과 | 7개 공개 경로×3테마×3폭, 읽기 16사례, 메모·메뉴·입력·구독 실패·대비·모바일 페이지 이동·Inspector·프로젝트 탐색·단축키 |
| 공개 화면 추가 production 검사 | 52/52 통과 | 상태/알 수 없는 경로/인증 callback 33, redirect 8, 검색 font·초점·hover 3, 실제 manifest 실패 복구 4, 최신 대표 화면 4 |
| 관리자 실제 React harness | 기본 72사례 통과 | 두 editor 진입, 3테마, 320–1920px 표본, 짧은 탐색, Logs·Prompts·선택 탭 |
| 나머지 관리자 화면 | 136사례 통과 | 17경로×빈 데이터/연결 실패×light/terminal×320/1440px. 잘린 조작·이름 없는 입력·문서 가로 넘침·runtime error 없음 |
| Playground 모델 패널 | 8사례 통과 | loading/error/empty/populated×light/terminal, 320px. 관리자 전체 담당 검증은 216사례 |
| 실제 Chat·Shell·xterm | 3개 테마 사례 통과 | 320px, Tab 경계·중첩 Escape·복귀·배경 스크롤·단축키 충돌 방지. xterm 초기화와 연결 차단 상태도 실제 확인 |
| 프로젝트 도구 겹침 회귀 | 8/8 통과 | light/terminal×320/768/1024/1440px. 필터·검색창 왼쪽 클릭·초점, 44px 조작, 가로 경계 확인 |
| 추가 관리자 기존 단위 검사 | 40통과 / 8실패 | 아래 baseline 대조로 기존 feature 본문에서도 동일 실패 확인 |
| 읽기 원본·기하 계약 | 38/38 통과 | `npm run verify:reading` |
| TypeScript | 통과 | 기존 app/node 설정 전체 |
| ESLint | 오류 0 / 경고 74 | 저장소의 기존 허용 경고 수와 동일 |
| Vite production bundle | 통과 | 직접 Vite 빌드. manifest/SEO/image 생성 및 static HTML 후처리를 포함한 전체 배포 pipeline과는 구분 |

브라우저 사례 수는 스크립트의 시나리오 수다. 한 시나리오에 여러 키보드/배치 검사가 들어간다. 같은 시나리오를 수정 후 재실행한 횟수는 별도 성과로 더하지 않았다. 위 관리자 단위 baseline 비교에는 후속 Playground 상태 안내 변경 이전의 테스트가 포함되므로 최종 Playground 8개 결과와 합산하지 않는다.

테스트의 외부/API 요청은 차단하거나 명시적 fixture로 응답했다. 실제 문의·구독·AI 요청, 서버 명령, 관리자 저장을 실행하지 않았다. 공개 route 검사는 실제 App을 실행하고, 관리자 harness는 실제 컴포넌트를 isolated provider 안에 렌더링한다. 따라서 후자는 인증 성공 또는 서버 권한의 증거가 아니다.

외부 웹폰트가 필요한 부분은 설치된 fallback 글꼴로 렌더링될 수 있다. 실제 휴대전화나 모든 웹폰트 로딩 상태의 동일한 픽셀 결과를 주장하지 않는다.

최초 브라우저 도구에서는 연결된 브라우저 목록이 비어 있어 설치된 Playwright/Chromium으로 로컬 확인을 수행했다. dev 서버의 cold import 지연으로 실패했던 초기 시도는 production preview에서 다시 검증했다. 메뉴 진입 애니메이션 중 경계 상자를 재던 테스트는 애니메이션 완료 후 측정하도록 수정했다.

추가 기존 Pagination 테스트 두 개는 원래 구현과 기대가 불일치했다. 원본에도 존재하는 비유한 현재 페이지→1 경계와 native number input의 숫자 입력을 검증하도록 고쳤다. 함수의 경계 동작을 테스트에 맞춰 변경하지 않았다.

## 재현과 증거

프런트엔드 디렉터리에서 실행한다. 테스트 브라우저는 로컬 preview를 대상으로 한다.

```sh
./node_modules/.bin/vite build --config config/vite.config.ts
./node_modules/.bin/vite preview --config config/vite.config.ts --host 127.0.0.1 --port 4174 --strictPort
# 별도 터미널
npx playwright test --config config/playwright.design.config.ts
npm run type-check
npm run lint
node --test scripts/ui-foundation-contracts.test.mjs scripts/ui-remaining-pages.test.mjs
```

설치된 Chromium 경로를 별도로 지정해야 하는 환경은 `DESIGN_CHROMIUM_PATH`, 다른 로컬 서버는 `DESIGN_BASE_URL`을 사용한다. 관리자 스크립트는 production preview가 아닌 dev 서버의 `scripts/design-verification/workspace.html`을 사용한다. 실행 명령과 JSON 측정 결과는 [작업공간 보고서](workspaces.md)에 있다.

| 상세 문서 | 내용 |
| --- | --- |
| [architecture.md](architecture.md) | 실제 전체 route 및 관리자 9 section/7 AI tab, 상태 소유권, 레이아웃 결정과 검증 행렬 |
| [discovery.md](discovery.md) | 홈·검색·게시글 목록의 결함별 근거, URL·history·로딩·실패 처리 |
| [discovery-failure.md](discovery-failure.md) | 실제 manifest 실패의 오류 전달과 캐시·재시도, 유효한 빈 목록과 기존 fallback 구분 |
| [public-final-review.md](public-final-review.md) | production 추가 검증, 최신 화면 시각 검수와 마지막 대비·클릭 경계 보완 |
| [secondary-pages.md](secondary-pages.md) | 소개·문의·프로젝트·미리보기·오류 화면의 개선 |
| [workspaces.md](workspaces.md) | 편집기·관리자·Insight의 실제 pane 측정, 스크린샷과 한계 |
| [overlay-focus.md](overlay-focus.md) | Chat·Shell·xterm·FAB의 중첩 초점/키보드 계약 |
| [contracts.md](contracts.md) | 원본 보존과 명시적 amendment, 148개 검사 근거 |
| [unit-results.json](unit-results.json) | 최종 통합 단위 검사 명령과 실제 파일별 통과 수 |
| [verification-summary.json](verification-summary.json) | 최종 검사 결과와 알려진 기존 테스트 실패 요약 |

공개 화면 전후 이미지는 `../../verification-screenshots/design-review-20260908/`에 보존했다. 이름이 `before-*`인 파일은 조사 시점이며, 프로젝트 catalog가 별도 작업으로 갱신되기 전인 `after-*` 이미지도 포함한다. 화면 이름·시점이 다른 이미지를 동일 데이터의 전후 비교로 사용하지 않는다.

최신 대표 화면: [홈 1440px](latest-home-light-1440.png), [글 목록 terminal 320px](latest-blog-terminal-320.png), [프로젝트 1440px](latest-projects-light-1440.png), [소개 terminal 320px](latest-about-terminal-320.png), [채팅 terminal 320px](chat-terminal-320.png), [빈 모델 안내](playground-models/empty-light-320.png).

추가 공개 경로 검사의 재현 스크립트는 `scripts/design-verification/public-review-browser.mjs`, 결과는 [public-review-browser-results.json](public-review-browser-results.json)이다. Chat·Shell·xterm은 `overlay-browser.mjs`와 [overlay-browser-results.json](overlay-browser-results.json)을 사용한다. 마지막 링크 대비 보완은 추가 검사와 강화된 Playwright primary 회귀에 별도 반영했다.

## 남은 검증과 작업 경계

- 관리자 확장 단위 48개 중 8개가 실패했다. 변경한 10개 feature 본문만 HEAD 원본으로 대체하는 읽기 전용 Vite loader 대조에서도 같은 테스트명·오류 첫 줄의 8개 실패가 재현됐다. 원인은 모호한 메뉴/텍스트 query, jsdom의 `scrollIntoView` 미구현, 입력 정규화 기대 등이다. 이 대조는 해당 사용부 변경을 분리한 증거이며 전체 worktree를 원본으로 돌려 검사했다는 뜻은 아니다. [상세 대조 결과](admin-coverage/unit-baseline-comparison.json)를 보존했다.
- 별도로 기존 `LogViewer.test.tsx`에는 stream 재개 후 append 기대가 실패하는 사례 1개가 있다. 기존 `PostEditorWorkspace.test.tsx`에는 삭제한 draft가 pending autosave로 다시 생성되는 사례 1개가 있다. 후자는 이전 `LOCAL_INTEGRATION.md`에도 기록돼 있다. UI 검증 통과를 전체 legacy suite 통과로 기록하지 않는다.
- 실제 휴대전화의 소프트 키보드, Safari/Firefox와 스크린리더, 서버와 연결된 저장/인증/AI/terminal 성공 상태는 이번 로컬 디자인 검증의 증거 범위 밖이다. skeleton 추가를 CLS 0 또는 INP 기준 달성으로 표현하지 않는다.
- 관리자 성공 차트·일부 내부 history/template dialog·비밀 관리의 정상 목록은 이번 fixture 행렬에 포함되지 않는다. 각 영역의 검증 상태는 [작업공간 표](workspaces.md)에 명시했다.
- 프로젝트 catalog와 생성 manifest/SEO 파일에는 작업 시작 전 및 다른 동시 작업의 변경이 있다. 이 디자인 작업이 해당 콘텐츠 변경을 작성한 것으로 간주하지 않으며 그대로 보존했다.

이번 작업은 전체 화면 구조의 상세 분석, 확인된 디자인·상호작용 결함의 구현, 위 범위의 로컬 검증까지 완료하는 것을 기준으로 한다. 실제 서비스 운영 상태와 명시된 미검증 환경까지 승인한 결과로 해석하지 않는다.
