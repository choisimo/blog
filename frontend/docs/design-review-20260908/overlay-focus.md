# 채팅·터미널 창의 키보드 초점 경계 — 2026-09-08

## 조사 근거와 구현

| 경계 | 기존 근거 | 개선 |
| --- | --- | --- |
| ChatWidget | fullscreen mobile div에 role=dialog만 있고 Tab containment, Escape 닫기, modal 여부, 명시적 닫기 후 복귀가 없었다. | 기존 레이아웃 div를 `OverlayDialog`의 Radix Content asChild로 감싼다. 모바일 및 확장 화면은 modal, 일반 데스크톱은 nonmodal이다. 데스크톱에서 뒤쪽 페이지와 상호작용해도 창을 닫지 않는다. |
| ShellModal / RealTerminalModal | createPortal div에 aria-modal=true를 선언했지만 실제 focus scope/layer stack은 없었다. | 같은 OverlayDialog를 사용한다. 44px/focus/reduced-motion 공통 스타일은 root가 `[data-overlay-dialog]` 범위에 적용한다. |
| 중첩 Sheet·AlertDialog·ImageDrawer | Chat의 하위 창은 이미 Radix지만 programmatic open이며 Trigger ref가 없었다. 독립적인 전역 Escape 리스너를 붙이면 부모와 하위 창이 함께 닫힐 수 있다. | 추가 전역 Escape 리스너 없이 기존 Radix DismissableLayer/FocusScope stack을 공유한다. 하위 창 lifecycle에서 실제 Chat 내부 opener를 저장하고, 모든 하위 창이 닫힌 후 그 버튼으로 복귀한다. Sheet→ImageDrawer 전환 중에는 복귀하지 않는다. |
| 가상 Shell 키 의미 | useShellCommander는 제안이 있으면 Escape로 제안만 지우고, 제안이 없으면 Shell을 닫는다. Radix는 document capture에서 Escape를 먼저 받는다. | 입력 focus의 Escape는 Dialog 기본 dismiss만 preventDefault하고 기존 입력 handler로 전달한다. 명령·history 동작은 유지한다. header 버튼 focus의 Escape는 Dialog가 닫는다. 제안 dropdown의 기준 위치는 실제 입력 header가 되도록 relative를 추가했다. 브라우저에서 발견한 동일 입력 제안 재생성 문제는 아래에 별도로 기록했다. |
| 실제 terminal 키 의미 | Escape는 vim 등 실행 중인 프로그램에서 필요하다. 설치된 xterm Terminal._keyDown은 Escape를 키 입력으로 전달하며 defaultPrevented를 이유로 생략하지 않는다. | terminal region 안의 Escape는 Dialog 닫기만 취소하고 전파를 유지한다. header 버튼에서 Escape를 누르면 닫는다. xterm, WebSocket, 인증·접속·재접속·종료 로직은 변경하지 않는다. |
| FAB 복귀 | `!toolbarDisabled` 조건으로 모달 동안 발동 버튼 DOM이 제거된다. 기존 DOM node만 저장하면 일반 닫힘에서도 복귀하지 못한다. | FAB가 chat/shell/path/output action의 callback ref를 관리한다. `useOverlayFocusReturn`은 창과 다른 modal presence가 모두 사라진 후 재마운트된 동일 action으로 돌아간다. Shell↔Real↔Chat은 하나의 복귀 세션으로 취급한다. 아래쪽 FAB는 focus-within일 때 숨김 위치에서 다시 나타난다. |
| 라우트 변경 | /blog 등은 GlobalAssistants가 FAB 자체를 unmount한다. owner effect만으로는 이 경우 복귀할 수 없다. | owner가 남은 경우 route와 원래 action을 확인한다. owner까지 제거된 경우에는 dialog unmount callback에서 main-content로 복귀한다. 일반 닫힘은 main으로 보내지 않는다. |

`OverlayDialog`는 설치되어 있던 `@radix-ui/react-dialog`만 사용한다. 관리되는 `components/ui/`를 편집하거나 dependency를 추가하지 않았다. 기존 createPortal과 같은 DOM mount 시점을 유지하도록 Portal의 container를 document.body로 명시하여, RealTerminal의 기존 ref 기반 초기화 effect를 변경할 필요가 없게 했다. 레이아웃 children, labels, 서비스 및 도메인 상태의 소유권은 원래 컴포넌트에 남아 있다.

## 파일

- 신규 `src/components/molecules/OverlayDialog.tsx`: Radix shared focus/layer stack, 제목, modal 여부, 선택적 초기 focus와 소유자 복귀 위임.
- 신규 `src/components/features/memo/fab/hooks/useOverlayFocusReturn.ts`: FAB action ref 등록, overlay 전환·toolbar 재등장 대기, 원래 action/route 제거에 따른 복귀.
- `chat/widget/index.tsx`, `chat/widget/components/ChatDialogs.tsx`: 창 wrapper 및 하위 팝업 focus lifecycle.
- `memo/fab/index.tsx`, `types.ts`, `DefaultDock.tsx`, `TerminalDock.tsx`, `ShellComponents.tsx`: 실제 발동 action refs와 owner 연결.
- `ShellModal.tsx`, `RealTerminalModal.tsx`: Portal 교체 및 Escape key ownership.
- `useShellCommander.ts`: 명시적으로 닫거나 선택한 제안을 같은 입력의 부모 rerender가 다시 열지 않도록 입력값 ref를 보관한다. 사용자가 입력을 바꾸면 제안을 다시 생성한다.

## 검증

```sh
cd frontend
npm run test:run -- src/components/molecules/OverlayDialog.test.tsx src/components/features/memo/fab src/components/features/chat/widget/index.test.tsx src/components/features/chat/widget/components/ChatDialogs.test.tsx
npm run type-check
```

- 실제 Radix를 사용하는 테스트: Tab/Shift+Tab 경계 순환, Sheet→AlertDialog 중첩 Escape가 최상위만 닫음, 하위 창→부모 버튼→최초 버튼의 복귀, nonmodal 배경 focus 유지.
- FAB harness: 원래 발동 DOM 제거·동일 action 재마운트, Shell→Real 전환 중 배경 focus 금지, 일반 닫기 후 원래 action, 라우트 변경 main fallback, FAB owner까지 unmount되는 라우트 fallback.
- Shell/Real 컴포넌트 테스트: 입력 Escape/Tab 콜백 유지, terminal input Escape 전달 유지, header Escape 닫기. 외부 terminal 서버에 접속하지 않도록 기존 hook mock을 사용한다.
- 기존 `ChatDialogs.test.tsx`의 제어문자 fixture는 JSX attribute literal이어서 실제 제어문자를 전달하지 않았다. JSX expression으로 수정하여 원래 sanitizer 검증 의도를 복구했다.
- 전체 type-check exit 0. 범위 ESLint는 0 errors / 기존 normalize helper export 경고 2개다.
- 테스트 실행 로그: `/tmp/blog-overlay-tests.log`, 타입 검사 로그: `/tmp/blog-overlay-typecheck.log`, 범위 lint 로그: `/tmp/blog-overlay-lint.log`.

최종 범위 실행은 **16개 파일 / 53개 테스트 통과**했다(05:25:19 실행, 9.90초). owner-unmount fallback과 실제 브라우저에서 발견한 제안 재생성 회귀 테스트 2개도 포함한다. 후속 전체 type-check도 exit 0이고, 제안 hook 및 테스트 범위 lint는 errors/warnings 모두 0이다(`/tmp/blog-shell-suggestions-lint.log`).

## 실제 브라우저 검증

재현 스크립트: [overlay-browser.mjs](../../scripts/design-verification/overlay-browser.mjs). 부모 작업에서 승인한 기존 Chromium/Playwright fallback으로 실행했다. `/blog`에는 GlobalAssistants/FAB가 원래 표시되지 않으므로 실제 `/` 페이지를 사용한다.

```sh
cd frontend
DESIGN_BASE_URL=http://127.0.0.1:4173 node scripts/design-verification/overlay-browser.mjs
```

`DESIGN_CHROMIUM_PATH`로 실행 파일을 바꿀 수 있고 기본값은 `/usr/bin/chromium`이다. 새 브라우저 context의 320×800 viewport, 한국어, reduced-motion 환경을 사용한다. 로컬 정적 파일 및 public-config fixture만 허용하고 나머지 API·외부 HTTP와 모든 WebSocket은 차단한다. fixture는 실제 Chat action을 열도록 `aiEnabled:true`를 제공한다. RealTerminal 검사만 `terminalEnabled:true` 및 실제 자격 증명이 아닌 고정 테스트 토큰을 주입한다. 서버 연결과 명령 실행은 일어나지 않는다.

브라우저가 lazy FAB와 메모 shadow panel을 모두 준비한 뒤 단축키를 누른다. Chat이 보이고 입력에 초점이 들어온 뒤 두 animation frame을 기다려 Radix layer 등록까지 완료된 상태를 검사한다. 다른 창에 가려져도 DOM의 visible assertion만 통과할 수 있으므로, 단축키로 연 Chat은 메모 panel 숨김과 실제 닫기 버튼의 hit test도 확인한다.

| 실제 화면 | 결과 |
| --- | --- |
| light/dark Chat | header 318px / scrollWidth 318px. 옵션·닫기 버튼 모두 44×44px, viewport 내부. Tab/Shift+Tab containment, Sheet Escape가 하위 창만 닫음, 옵션 버튼으로 복귀, Chat 닫기 후 실제 재마운트된 Chat action으로 복귀. |
| Chat와 하위 Sheet | 부모 header 또는 Sheet 바깥에 wheel 입력을 보내도 underlying window.scrollY 0→0으로 유지. |
| terminal Shell | 제안 dropdown y=113.25px, 높이 164.39px로 viewport 내부. 첫 Escape는 제안만 닫고 두 번째는 Shell을 닫음. header Escape, Tab containment, 원래 Shell action 복귀, 배경 scroll 0→0 유지. |
| terminal RealTerminal | 실제 xterm DOM 초기화와 Disconnected 표시 확인. terminal 입력의 Escape는 창을 유지하고 header Escape는 닫음. Tab containment와 원래 Shell action 복귀 확인. |
| terminal Chat | Ctrl+Alt+M으로 연 Chat header 318px 및 44×44px 버튼 확인. 메모 panel이 함께 열리지 않고 Chat 닫기 후 원래 Shell action으로 복귀. |

모든 case의 `pageerror`는 0개다. 최종 수치와 차단 요청은 [overlay-browser-results.json](./overlay-browser-results.json), 실행 로그는 `/tmp/blog-overlay-browser.log`에 있다. 화면 캡처는 [light Chat](./chat-light-320.png), [dark Chat](./chat-dark-320.png), [하위 Sheet](./chat-dark-320-sheet.png), [Shell 제안](./shell-terminal-320-suggestions.png), [연결되지 않은 RealTerminal](./real-terminal-320-disconnected.png), [terminal Chat](./chat-terminal-320.png)이다. `*-failure.png`는 개발 중 실패 시점의 진단 캡처이며 최종 판정은 JSON의 failures 배열을 따른다.

### 브라우저에서 발견해 수정한 실제 결함

1. Shell에 `c`를 입력하면 4개 제안이 나타났지만 Escape로 닫아도 즉시 다시 생성됐다. `generateSuggestions`가 부모의 새 callback/vfs 객체 때문에 바뀌면서 입력이 같아도 effect가 재실행된 것이 원인이다. `dismissedSuggestionsForRef`가 동일 입력의 명시적 닫힘을 유지하게 했다. 부모 rerender 후에도 닫힘 유지, 새 입력 시 재개, Tab 선택 후 닫힘을 hook 테스트로 확인하고 실제 브라우저에서 첫/두 번째 Escape를 확인했다. 네트워크와 명령 실행 경로는 변경하지 않았다.
2. terminal Chat 캡처를 직접 확인하자 Chat 위에 메모 편집기가 함께 열려 있었다. 메모의 `Alt+M` 조건이 `Ctrl+Alt+M`도 허용했고 `defaultPrevented`만으로는 리스너 등록 순서에 따라 충돌했다. root가 메모 소유 파일에서 `!ctrlKey && !metaKey`를 추가하고 자체 단축키에서 기본 동작을 막도록 수정했다. 스크립트에도 shadow panel 숨김과 Chat 닫기 버튼 hit test를 추가하여 DOM visible 검사만으로 놓치던 겹침을 검증한다.

개발 중 `he`를 자동완성 fixture로 사용한 것은 잘못된 테스트 입력이었다. `help`는 명령 목록의 일반 제안 항목이 아니라 별도 실행 분기다. 제안이 존재하는 `c`로 수정했다. RealTerminal 닫기 버튼의 실제 영문 accessible label을 사용하는 변경과 lazy layer 준비 대기는 테스트 준비 상태 정정이며 제품 결함으로 집계하지 않는다.

## 한계

이 검증은 개발 서버에서의 focus·키 전달·레이어 경계와 연결되지 않은 화면을 증명한다. production 재빌드·통합 판정은 root가 수행한다. 실제 terminal 서버 연결과 명령 실행, 대화 AI 제공자 응답 성공은 이번 변경에서 실행하지 않았다. 외부 폰트도 차단하므로 캡처는 fallback font 환경이다. iframe 프로젝트 미리보기와 문의 폼 검증은 별도 `secondary-pages.md`에 기록했다.
