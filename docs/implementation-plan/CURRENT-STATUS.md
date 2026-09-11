# 통합본 재점검 및 다음 구현 기준

기준일: 2026-09-10. 대상은 제공된 `blog-integrated-source-20260910.zip`이며 운영 배포 상태가 아니다.

## 이번에 한 일

최신 통합본을 이전 Reader 압축본과 비교하고, 후속 PR 체크리스트를 루트 `tasks.md`로 작성했다. 기존 애플리케이션 소스는 바꾸지 않고 계획 문서·읽기 전용 진단 코드·검증 기록만 추가했다. 원격 PR 생성·배포·유료 AI 호출은 수행하지 않았다.

- 입력 ZIP: 5,544,559 bytes.
- 입력 SHA-256: `40b2c5dce9e875795e6fe233e708bf962a13215e2dc656e0f01837ca6b402c0e`.
- 원래 ZIP CRC 검사: 오류 없음.
- 의존성 사본을 제외한 원래 파일: 1,957개. 최종 전달본에서 각 파일의 SHA-256 보존을 검사한다.
- 이전 Reader 압축본 대비: 기존 경로 누락 0개, 추가 69개(Projects Markdown 68개와 SEO 테스트 1개), 변경 경로 11개.
- 변경 11개 중 `backend/nginx.conf`는 이전 심볼릭 링크가 최신 입력에서 일반 파일로 풀린 차이다. 현재 `backend/nginx/nginx.conf`와 내용이 같다. 이번 작업에서 다시 링크로 바꾸지는 않았다.

## 1. 구현이 들어간 범위

메모장의 작성 중심 레이아웃, 선택적 분할 미리보기, 검색·목차·집중 모드, 저장 실패 보호가 포함돼 있다. 사용자별 AI 역할·응답 스타일·이미지 설정과 계정 저장/CAS가 있고, Chat·토론에는 독자 이미지 카드가 연결돼 있다. 독자 이미지 생성은 기존 backend image adapter를 사용하며 서버의 비회원 5장/일 예약, KST 날짜, 중복키, private owner 검사와 보관 정책이 존재한다.

이후 통합 단계에서 공개 번역 요청을 기존 translation job 시작/참여 경로에 연결하고 public status route 및 202 job 응답을 추가했다. Projects catalog와 검토 요약을 바탕으로 Markdown/manifest 68개를 생성하고 runtime catalog fallback을 추가했다. 일반 사용자용 SEO 자산/원문 origin 분기도 일부 개선됐다.

**위 설명은 코드 포함 여부다. 일반 회원가입, 실제 provider 통합, 전체 제품 빌드 및 운영 배포까지 완료됐다는 뜻이 아니다.** 이미지 feature flag는 현재 false이고 private R2 실제 연결도 운영에서 확인하지 않았다.

## 2. 다음 PR을 완료로 표시하면 안 되는 이유

### A01: 검색봇 자산 분기가 아직 남아 있다

현재 자산 프록시는 `if (!isCrawler(userAgent))` 내부에 있다. 일반 UA의 robots/sitemap/JS/PNG는 파일 응답을 받지만 Googlebot/Bingbot은 shell HTML을 받는 경로를 유지한다. 실제 source function과 fetch/HTMLRewriter 대체물을 사용한 12개 조합 재현에서도 같은 결과가 나왔다.

또한 robots/sitemap은 `isBundledAssetPath`에서 true가 되어 일반 UA에도 `public, max-age=31536000, immutable`로 전달된다. `/projects`는 resolver에서 별도로 처리하지 않아 홈 canonical을 반환하고, percent-encoded 한글 slug도 실제 제목으로 해석되지 않았다. 미존재 글은 200 shell이었다.

근거: `workers/seo-gateway/src/index.ts:97–133, 188–197, 240–268`, `src/post-resolver.ts:32–124`. 재현: `verification/pr-plan-20260910/diagnostics.json`의 D01/D02. **HTMLRewriter는 passthrough 대체물로, 실제 HTML 태그 변환을 검증한 결과는 아니다.**

### A02: 즉시 job 접수와 작업 내구성/관찰 완료는 다르다

공개 요청은 `startOrJoinTranslationJob`을 호출하고, 새 작업은 `waitUntil`에 전달한다. 기존 배경 outbox 번역 경로도 별도로 남아 있다. 동일 실행 계약, 실패 후 자동 재생성 제한, isolate 종료 후 소비/복구가 완결됐다고 확인할 수 없다.

화면은 상한을 20초/5회에서 90초/12회로 늘렸지만, 관찰 종료 시 여전히 `AI_TIMEOUT` 오류로 바꾼다. 3초 간격이 계속 적용되면 12회 제한이 90초보다 먼저 끝날 수 있다. 초기 응답부터 12번째 pending까지 단순 계산상 약 33초이며 실제 운영 지연을 측정한 수치는 아니다.

shared runtime schema는 수정됐지만 `.d.ts` 선언은 이전 필수/선택 필드 구조를 유지한다. 프런트 job parser는 queued를 받지 않고, 중첩 오류 코드와 공개/internal status URL의 일치도 추가 점검이 필요하다. slug 정규식 범위는 넓어졌지만 명시적 dot-segment 거절과 Unicode 정규화는 아직 통합되지 않았다. 해당 소스에는 직접 들어간 NUL/0x1F 바이트도 확인됐다.

근거: `workers/api-gateway/src/routes/translate.ts:163–182, 281–371, 397–468, 495–523`; `routes/lib/translation-jobs.ts`; `lib/ai-artifact-outbox.ts`; `frontend/src/pages/public/BlogPost.tsx:539–615`; `frontend/src/services/content/translate.ts:93–138, 168–260`; `shared/src/contracts/translation.js`/`.d.ts`. D08은 제어 바이트 위치만 확인한 진단이다.

### A03: 68개 복구는 확인됐지만 파서·오류·fallback에는 남은 문제가 있다

임시 디렉터리에서 현재 생성기를 실행한 결과 Markdown/manifest 68개가 생성됐고, IDs는 모두 고유하며 기존 전달 manifest의 items와 같았다. 실제 GitHub 최신 목록이나 원본 evidence bundle 전체를 재검증한 것은 아니다.

현재 생성기는 gray-matter 대신 단순 줄/JSON 파서를 사용한다. 합성 YAML의 `description: |`는 `|`로, block list 형태의 tags는 빈 배열로 저장됐다. 정상 YAML 의미를 잃는 회귀이므로 배포 전 수정해야 한다.

manifest와 catalog가 모두 503이면 `ProjectService.getAllProjects()`는 reject하지 않고 빈 배열을 반환한다. 빈 결과를 캐시하지는 않으므로 다음 호출이 정상 응답이면 복구되는 좁은 경로는 개선됐다. 그러나 fallback이 한 번 성공하면 캐시에 남아 이후 기본 manifest를 다시 조회하지 않는다. 이 경로의 ID는 `catalog-*`여서 복구된 기본 manifest의 `choisimo--*`와도 다르다. `Date.now()` query 역시 남아 있다.

근거: `frontend/scripts/generate-projects-manifest.js`의 `parseFrontmatter`/`ensureSeedProjectData`; `frontend/src/services/content/projectService.ts:169–285`; D03–D07.

### R07-1: 서명 검증뿐 아니라 익명 ID 발급 근거도 확인해야 한다

현재 `/auth/anonymous`는 요청의 `existingId`가 형식에 맞으면 같은 ID를 JWT sub로 사용한다. 이 route 안에서 해당 ID의 기존 소유 자격을 확인하는 코드는 보이지 않는다. 이미지 owner는 그 sub에서 계산된다.

따라서 “다른 sub가 이미지를 못 읽는다”는 repository 검사만으로 익명 데이터의 전체 소유권 보장을 완료할 수 없다. 기존 ID 재사용에는 소유 증명이 필요하다는 후속 PR을 P0로 분리했다. **이것은 코드 경로에서 확인한 위험이며 실제 타인 정보 접근이나 운영 침해를 확인한 결과가 아니다.**

근거: `workers/api-gateway/src/routes/auth.ts:1042–1071`; `workers/api-gateway/src/routes/reader-images.ts:15–26, 63–75`.

### A04 이후: 기존 기반과 새 완료 기준을 구분해야 한다

`translation-service.ts`는 여전히 본문만의 32비트 hash, 30,000자 절단, 생성 결과의 즉시 캐시 쓰기를 사용한다. 일반 Chat은 실제 SSE가 있지만 구조화 카드의 점진 응답·provider 취소·측정은 별도 후속 작업이다.

독자 이미지의 최초 생성 요청도 결과를 기다리며, 생성 성공/저장 실패 분리 복구와 unknown 정산은 완결되지 않았다. 개인 이미지와 공개 게시글 자산의 경계, 현재 private reservation/retention 검사를 유지하면서 작업 실행을 보강해야 한다.

공개 static HTML은 본문을 생성하는 상태로 바뀌지 않았고, JSON-LD inline 직렬화·중복 article tags·실제 수정일도 후속 작업이다. 회원가입/guest 이관/남용 보호, Projects 사례/About 사실 확인, 비용 제한형 배경 SEO 역시 계획에 남겨 두었다.

근거: `workers/api-gateway/src/lib/translation-service.ts:119–135, 248–345`; `frontend/src/services/discovery/ai.ts`; `backend/src/lib/chat-streaming.js`; `workers/api-gateway/src/routes/reader-images.ts`; `frontend/scripts/generate-static-html.js`; `frontend/src/hooks/seo/useSEO.ts`; 이전 Reader 계획의 미완료 항목.

## 3. 이번 실행의 검증 결과

| 구분 | 이번 결과 | 범위/제한 |
|---|---|---|
| 입력 ZIP CRC | 오류 없음 | 압축 데이터 무결성이지 기능 검증이 아님 |
| 이전 Reader 대비 파일 비교 | 기존 경로 누락 0개 | UTF-8 경로 기준, 제품 소스 변경 자체를 성공으로 평가하지 않음 |
| 독자 이미지 계약 테스트 | 26 passed / 0 failed | 실제 policy/repository SQL 및 SQLite, HTTP/provider E2E 아님 |
| 변경 소스 문법 | 41 passed / 0 failed | TS transpile + JS/MJS/CJS `node --check`, 타입/번들 검증 아님 |
| Projects generator | 68개/고유 ID 68개/기존 items 일치 | 임시 복사본, 원본 파일 갱신 없음 |
| 추가 진단 | 8개 그룹 실행 | 알려진 문제 재현도 포함, “8개 기능 테스트 통과”가 아님 |
| SEO 원래 typecheck 시도 | 종료 코드 2 | `@cloudflare/workers-types` 없음 |
| API Worker 원래 test 시도 | 종료 코드 127 | `vitest` 실행 파일 없음, 테스트 시작 전 실패 |
| Frontend 원래 test:run 시도 | 종료 코드 127 | `vitest` 실행 파일 없음, 테스트 시작 전 실패 |
| 전체 build/운영 배포/provider 실생성 | 미실행 | 성공으로 보고하지 않음 |

기존 `verification/reader-experience/`의 브라우저 9개 조합 기록은 이전 실행 결과다. 이번에 다시 브라우저 테스트를 실행한 것은 아니며, 이전에도 저장소는 메모리 어댑터였다. 그 기록은 보존하되 실제 브라우저 재시작 후 저장 유지 또는 회원 인증 E2E로 확대 해석하지 않는다.

현재 기록은 `verification/pr-plan-20260910/`에 별도로 저장했다. 기존 Reader 검증 파일의 내용을 새 결과로 덮어쓰지 않았다.

## 4. 원문과 운영 자료의 경계

현재 `frontend/public/posts/`의 게시글 Markdown은 0개다. `posts-manifest.json`의 항목은 282개이며 공개 판정 항목은 140개다. Projects의 복구된 Markdown 68개는 게시글 원문이 아니다.

이 수치는 제공 파일의 inventory다. 운영 게시글 삭제나 운영 서비스 장애를 의미하지 않는다. 게시글 원문이 없는 상태에서 build의 manifest 생성 단계가 빈 산출물을 만들지 않도록 원문 확보와 입력 검증을 A03/A07/A10의 선행 조건으로 정리했다. 이번 작업에서는 게시글 원문이나 최신 AI-server 계약을 추측해 추가하지 않았다.

## 5. 파일명과 재포장

입력 ZIP에는 UTF-8 flag가 없는 비ASCII 일반 파일 경로가 99개 있다. UTF-8로 filename metadata를 해석하면 이전 Reader의 한글 경로와 맞고 파일 내용도 보존된다. 기본 CP437 해석은 이름을 깨뜨릴 수 있으므로 최종 ZIP은 UTF-8 경로가 명시되도록 새로 작성한다. 이는 제품 경로를 임의 변경한 것이 아니라 원래 UTF-8 이름을 유지하는 포장 조정이다.

기존 `.git`은 입력 ZIP에 포함돼 있지 않다. 불완전한 `node_modules`의 27개 파일 사본은 재포장 대상에서 제외한다. package manifest/lockfile, 앱·backend·Worker·shared 소스, 기존 문서·테스트·스크린샷은 보존한다. 폰트 파일은 입력에 없다.

최종 압축본에는 루트 `tasks.md`, 이 문서, 이전 감사 자료, 이번 검증 기록, `MANIFEST.sha256`을 추가한다. 최종 파일명·CRC·내용 비교·SHA-256은 전달 시 별도 기록한다.
