# 공개 화면과 공통 디자인의 최종 독립 검수

검수 범위는 공통 index/layout/page/token CSS, 메모의 열림·닫힘, Footer와 테마·언어·메뉴, 누락되었던 상태/인증 복귀 라우트다. 기존 세 테마와 정보 구조를 유지한 변경만 검토했다. 다른 작업에서 갱신한 68개 프로젝트 카탈로그는 실제 최신 화면에서 확인했으며 디자인 작업의 데이터 변경으로 분류하지 않는다.

## 발견 및 해결

| 확인된 문제 | 근거와 최종 조치 |
| --- | --- |
| light primary 버튼 hover 대비 손실 | 전역 hover가 semantic primary 배경을 덮었다. root가 전역 규칙의 specificity를 낮췄고 세 테마의 normal/hover 색 보존을 Chromium에서 확인했다. |
| terminal primary anchor 대비 손실 | About의 “연락하기”에서 `rgb(61,255,158)` 글자 / `rgb(141,226,177)` 배경, 계산 대비 1.17:1을 재현했다. 전역 terminal anchor 규칙에서 실제 UI control 변형을 제외한 뒤 글자가 `rgb(16,37,26)`으로 복구됐다. normal/hover 색 기준 대비는 light 6.70:1, dark 9.44:1, terminal 10.48:1이다. |
| terminal 헤더 검색 글자 및 초기 초점 | 390px input이 12.25px였고 시트를 열면 첫 `grep` 보조 버튼에 초점이 갔다. root가 모바일 input 16px 및 실제 검색 input 초기 초점을 명시했다. 세 테마에서 input 16px/48px, 열기 직후 input focus, Escape 뒤 검색 발신 버튼 복원이 통과했다. |
| 닫힌 메모 노출 및 닫기 초점 | 닫힌 패널 규칙은 모바일 display:flex보다 우선하도록 수정됐다. root의 updateOpen은 열기 전 연결된 요소를 저장하고 닫을 때 복원하며, 요소가 없어지면 main-content를 사용한다. 실제 열기·닫기·경로 이동·발신 초점은 root의 site-design E2E 시나리오가 검증한다. |
| 실제 manifest 실패가 빈 성공으로 처리됨 | 요청 차단 시 오류 UI 대신 “찾는 글이 없습니다”와 retry 0개가 나왔다. 서비스 실패가 빈 cache가 되지 않도록 하고 Index/Blog만 adapter 오류 전달에 참여시켰다. 실제 서비스에 503→정상 manifest를 제공하여 URL과 검색어 보존 재시도를 확인했다. 상세 계약은 `discovery-failure.md`에 있다. |
| Projects 첫 필터가 desktop dock에 가려짐 | 수정 전 1440×900의 첫 필터 x=36..91.77에서 왼쪽 5px 클릭이 `Visited Stack` FAB로 전달됐다. root가 768px 이상 Projects 여백을 72px로 확보했다. 8개 지정 사례에서 실제 hit-test·왼쪽 클릭 후 초점·44px 크기·가로 잘림 검사를 통과했다. |

Footer는 실제 POST 경계의 pending·실패 원문 보존·입력 변경 피드백 reset·성공을 단위 테스트와 root 브라우저 시나리오로 검증했다. theme/language menuitemradio, loading fallback, 닫힘 specificity에서 추가 동작 회귀는 발견하지 못했다.

## 실행 결과

`public-review-browser-results.json`은 최종 로컬 production preview `http://127.0.0.1:4174`에서 **52개 사례 통과, failures 0개**를 기록한다.

- 세 테마 × 320px의 400/401/403/404/429/500/503, `/admin/unknown`, `/insight/unknown`, callback missing credential/provider error: 33개. 실제 status code, main/버튼 경계 및 44px 조작 크기를 확인했다. Callback은 새 문서로 진입하여 fragment 제거와 일반적인 복구 메시지를 확인했다.
- 상태 별칭 7개와 contact→about 이동: 8개.
- 세 테마의 검색 input·초기/복원 초점·primary hover: 3개.
- light/terminal의 Blog/Home 실제 manifest 503 후 재시도: 4개. 블로그는 category/tag/q/sort/page=2를 그대로 유지하고 마지막 3개 글을 표시했다. 홈은 Runtime 검색어와 전체 15개 결과 및 최신 글 복구를 확인했다.
- 최신 대표 화면 4개: 홈 light1440, 블로그 terminal320, 프로젝트 light1440(68개 저장소), 소개 terminal320.

이 52개 검증 이후 발견한 terminal anchor 색은 root의 CSS 수정 후 `public-primary-link-contrast-results.json`의 **3개 테마 대상 검사**로 확인했다. 이 파일의 대상은 개발 preview 4173이며, 위 52개 production 기록을 덮어쓰지 않았다. About terminal320 스크린샷은 이 최종 색 수정 후 갱신했다. root의 최종 build/E2E 결과는 통합 REPORT를 따른다.

Projects dock 여백 수정은 `projects-dock-browser-results.json`의 **8개 대상 검사**로 확인했다. 개발 preview 4173에서 light·terminal 각각 320/768/1024/1440px를 사용했으며, 실제 dock가 보이는 상태로 첫 필터·검색창 외곽·검색 input 왼쪽 5px의 hit-test와 클릭 초점을 확인했다. 768px 이상에서 좌우 padding은 72px, 320px에서는 기존 16px이며, 검사한 catalog control은 44px 이상이고 document 가로 overflow가 없었다. 최신 `latest-projects-light-1440.png`를 이 수정 이후 갱신하고 직접 시각 검수했다. 재현 스크립트는 `scripts/design-verification/projects-dock-browser.mjs`다.

```sh
cd frontend
DESIGN_BASE_URL=http://127.0.0.1:4174 \
DESIGN_CHROMIUM_PATH=/path/to/chromium \
node scripts/design-verification/public-review-browser.mjs

# 색 변경만 다시 확인하고 기존 52개 결과를 보존하는 예
DESIGN_PUBLIC_SECTIONS=contrast \
DESIGN_PUBLIC_RESULTS=public-primary-link-contrast-results.json \
DESIGN_CHROMIUM_PATH=/path/to/chromium \
node scripts/design-verification/public-review-browser.mjs
```

데이터 실패 후속의 6개 파일 20개 단위 테스트, type-check, source guard 148개가 통과했다. 원본 baseline 바이트와 모든 declaration before 해시는 보존했다. 외부 API·외부 HTTP·WebSocket은 차단했으므로 실제 운영 서버의 가용성이나 전송 성공을 검증한 결과로 해석하지 않는다.

## 검증 한계

이 독립 검수에서 재현한 P2 Projects dock 겹침은 해결됐으며 미해결로 남겨둔 확인된 동작 차단은 없다.

정상 JSON의 malformed top-level manifest를 빈 목록으로 처리하는 기존 계약은 유지했다. 실제 iOS Safari, screen reader 낭독, CLS/INP 수치는 이 Chromium 검수 범위에 포함하지 않았다.
