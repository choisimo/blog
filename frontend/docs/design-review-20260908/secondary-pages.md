# 보조 공개 페이지 디자인 개선 — 2026-09-08

## 검토 범위와 구현 계약

- 공개 프로젝트 목록·프로젝트 카드·미리보기·로딩 자리 표시자, 소개 및 문의 폼, 공통 오류 페이지를 검토했다.
- 기존 React 18, Tailwind, Radix 기반 UI와 `ui-*` 디자인 토큰을 유지했다. 관리되는 `components/ui/`, 콘텐츠 manifest, 서비스 구현·설정은 수정하지 않았다.
- `frontend/AGENTS.md`, `frontend/src/components/AGENTS.md`, `frontend-designer` 및 `tester` 스킬을 적용했다.
- 공통 `ui-pages.css`는 root 담당이다. 소개 제목·긴 영문 줄바꿈 및 오류 페이지 줄바꿈·아이콘 간격 보완을 전달했고 현재 파일에 반영된 것을 확인했다.

## 발견 및 개선

| 화면 | 발견한 문제와 근거 | 적용한 변화 |
| --- | --- | --- |
| 소개 정보 위계 | `About.tsx`는 한국어 본문에 About / Contact & Skill / Send a Message를 혼용했고 CardTitle의 기본 h3로 h1 다음 h2를 생략했다. 연락 폼보다 긴 기술 카드가 먼저 나왔으며 #contact가 폼이 아닌 기술 카드에 붙어 있었다. | 소개·프로필·기술 분야·문의의 h1/h2/h3 위계를 정리했다. 상단 연락/기술 바로가기, 실제 폼의 #contact와 scroll offset, 프로필 아래 소셜 링크를 제공한다. |
| 기술 상세 가독성 | 기술 상세는 12px, 배지는 11px였고 좁은 화면에서 긴 영어 내용과 아이콘의 줄바꿈 여유가 부족했다. | 본문 14px, 배지 12px, 제목 16px, 명시적 행간·간격을 사용한다. 축소되지 않는 장식 아이콘, min-width:0, 긴 영문 overflow-wrap을 적용한다. |
| 문의 상태 | 결과가 toast에만 남았고 전송 제공자 EmailJS/API가 사용자 설명에 노출되었다. 제출 중에도 입력을 수정할 수 있어 성공 시 새로 적은 내용까지 초기화될 수 있었다. | 한국어 사용자 문구, 폼 내부 지속 성공·실패 상태, 전송 중 fieldset 잠금, 실패 시 원문 보존과 이메일 대체 경로를 적용했다. 새 입력을 시작하면 이전 결과를 해제한다. |
| 문의 입력 | 서비스는 이름/이메일/제목/메시지 120/254/200/5000자 제한을 검증하지만 폼에는 제한이나 자동완성이 없었다. | 동일한 maxLength, name/email autocomplete, 필수 항목 설명, 메시지 글자 수를 제공한다. 실제 송신 경계는 기존 `sendContactMessage`를 유지한다. |
| 소셜 정보 | `site.social.linkedin`은 작성자 프로필이 아닌 LinkedIn 홈 주소다. | 소개 화면은 경로가 있는 LinkedIn 주소만 표시한다. 실제 프로필을 추측하거나 설정을 변경하지 않는다. |
| 프로젝트 탐색 | 검색 지우기·필터 초기화 버튼은 클릭 후 사라져 키보드 focus가 유실될 수 있다. 결과 요약 flex에는 긴 선택 태그와 초기화 버튼의 wrap 계약이 없었다. | 검색 입력 ref로 focus를 복귀시키고 검색어·태그 초기화를 통합한다. 결과 요약은 wrap, min-width, overflow-wrap을 갖는다. 검색 입력과 결과 요약을 aria-describedby로 연결한다. |
| 프로젝트 액션 | link 프로젝트가 `window.open` 버튼이어서 복사/중간 클릭·브라우저 링크 동작을 제공하지 않았다. 모바일 embed도 미리보기 버튼처럼 보이지만 새 탭으로 이동했다. | link 및 모바일 embed는 안전한 실제 a 링크로 표시한다. 제목을 포함한 접근 가능한 이름과 새 탭 안내를 제공하며 중복 서비스 링크를 제거한다. 콘솔·데스크톱 embed는 미리보기 버튼을 유지한다. |
| 프로젝트 로딩·실패 | 목록 모드에서도 카드 스켈레톤을 사용했고 각 스켈레톤의 status가 반복 낭독될 수 있었다. 오류에는 raw loadError가 표시되었다. | 선택한 표시 방식의 skeleton과 카드 320px/목록 220px 예약 공간, opacity 로딩 효과를 사용한다. 페이지 수준 결과 status만 낭독하며 오류는 연결 확인·재시도를 안내한다. |
| 프로젝트 모달 | 닫기 버튼이 외부 열기/전체 화면과 같은 가변 flex 묶음에 있어 좁은 화면에서 위치가 흔들렸다. iframe 로딩 안내 및 trigger 없는 제어형 Dialog의 명시적 focus 복귀가 없었다. | 제목과 44px 닫기 영역을 두 열로 분리하고 액션·대체 경로를 아래에 배치한다. iframe loading/error 상태, 지속적인 새 탭 대체 안내, 열기 전 활성 요소로 focus 복귀를 추가했다. |
| 오류 페이지 | 링크 장식 아이콘의 accessibility tree 노출, 줄바꿈·아이콘 간격 계약이 부족했다. | 장식 아이콘을 aria-hidden 처리하고 축소를 막았다. 외부 액션의 새 탭 안내를 추가했으며 긴 문구/액션 wrap과 복구 링크 gap은 root의 공통 CSS로 보완했다. |

## 토큰과 상태

- 기존 `--ui-canvas`, `--ui-surface`, `--ui-soft`, `--ui-text`, `--ui-muted`, `--ui-accent`, `--ui-danger`를 사용하므로 light/dark/terminal 팔레트를 공유한다.
- 프로젝트 눌림 피드백은 140ms `cubic-bezier(.2,.8,.2,1)`의 1px translate, 스켈레톤은 opacity만 변화한다. reduced-motion에서는 모두 해제한다. 기존 공통 focus-visible·disabled·44px control 계약을 유지한다.
- 기본, hover, active, keyboard focus, disabled, loading, empty, error, submit success 상태를 포함한다.

## 검증 결과

기존 테스트 실행에서는 31개 중 11개가 이미 실패했다. 실패 원인은 구형 ProjectCard의 Preview/Visit/Code 및 이미지 문구 기대, Dialog mock의 DialogDescription 누락, skeleton hidden 노드 수 12개 고정 기대였다. 실제 현재의 안전한 링크/미리보기·숨김 처리 계약을 검증하도록 수정했다.

다음 범위는 **11개 파일, 34개 테스트 통과**했다.

```sh
cd frontend
npm run test:run -- src/test/Projects.test.tsx src/test/ProjectCard.test.tsx src/test/ProjectModal.test.tsx src/test/projectsData.test.ts src/test/aboutLinks.test.ts src/test/errorStatusPage.test.tsx src/test/About.test.tsx src/components/features/projects
```

- `About.test.tsx`: 전송 중 필드 잠금·중복 제출 방지, 성공 확인과 초기화, 실패 시 원문 보존·이메일 경로·재시도. 서비스 mock을 사용하여 실제 메시지를 송신하지 않았다.
- ProjectCard: URL/text 정규화 유지, 실제 link 탐색, 모바일 embed의 새 탭 링크 및 미리보기 중복 제거.
- ProjectModal 및 기타 기존 테스트: URL/text 경계, 안전한 iframe/외부 링크, 콘솔 닫기, 기술 필터 및 스켈레톤 접근성.
- 범위 ESLint: **0 errors / 8 warnings**. 8개는 기존 컴포넌트 파일의 normalize helper export에 대한 `react-refresh/only-export-components` 경고다.
- 수정한 TSX와 CSS에 저장소 Prettier 설정을 적용했다.

## 브라우저 검증 인계 및 잔여 한계

root에 다음 실제 브라우저 시나리오를 요청했다. 브라우저 결과와 전체 type-check/build는 통합 보고서가 증거를 소유한다.

1. 320px 및 terminal 테마에서 프로젝트 긴 태그·검색 초기화·목록 전환의 가로 오버플로와 44px 터치 영역.
2. 검색 지우기 및 초기화 후 searchbox focus, 모달 닫기/Escape 후 원래 미리보기 버튼 focus.
3. 소개 #contact 바로가기, 기술 내용의 긴 영어 줄바꿈, 오류 페이지 복구 링크 간격.
4. 데스크톱 embed와 콘솔 모달의 헤더/닫기 위치, 모바일 새 탭 액션.

교차 출처 iframe의 onLoad는 대상 콘텐츠가 실제로 표시되었다는 증거가 아니다. 대상의 CSP/X-Frame-Options 차단은 호스트에서 확실하게 판별할 수 없으므로 새 탭 대체 안내를 항상 제공한다. 미리보기 실제 동작은 통합 브라우저 검증이 필요하다. 스켈레톤은 로딩 공간을 확보하지만 가변 길이 콘텐츠/선택적 이미지가 있으므로 CLS 0을 주장하지 않는다. 실제 연락 전달 성공은 외부 서비스 검증 범위이며 이번 작업은 mock으로 폼 상태를 검증했다.
