# 블로그 통합 소스 — 다음 PR 작업 목록

기준일: 2026-09-10 · 기준 입력: `blog-integrated-r07-1-20260910.zip`

입력 SHA-256: `6a35bd09e50b455f7a29aed1452703e1ae050ed10ca216a85c9e04311da97e75`

이 문서는 실제 구현과 남은 검증을 구분하는 계획이다. 원격 PR 생성·병합·배포를 의미하지 않는다. 이번 실행에서는 R07-1 통합본의 2,031개 파일을 확인한 뒤 A02 번역 실행·관찰·복구를 구현했다. 기존 A01–A10 번호와 R06/R07 하위 PR은 유지한다.

**A02 핵심 소스와 분리 검사 97개를 반영했다.** 기존 익명 인증 84개·이미지 계약 26개·SEO 112개를 재실행해 통과했다. 실제 Worker/React/Zod 전체 suite와 타입 검사는 의존성 부재로 미완료다. A01 runtime/staging, R07-1 실제 인증·브라우저 운영 검증도 남아 있다. 입력본의 `src/routes/secrets`와 `src/lib/secrets` 누락을 임의 구현으로 대체하지 않았다. 번역 실행과 이미지 flag는 꺼진 상태다. 상세 결과: [A02 구현 기록](docs/translation-a02/IMPLEMENTATION.ko.md), [0041·배포 순서](docs/translation-a02/DEPLOYMENT.ko.md).

이전 R07-1 기록은 [구현 결과](docs/anonymous-r07-1/IMPLEMENTATION.ko.md)와 [배포 순서](docs/anonymous-r07-1/DEPLOYMENT.ko.md)에 보존했다.

지난 A01 결과는 [구현 기록](docs/seo-a01/IMPLEMENTATION.ko.md)과 [검증·배포 순서](docs/seo-a01/DEPLOYMENT.ko.md)에 있다. 이전 통합 상태의 세부 확인 근거는 [CURRENT-STATUS.md](docs/implementation-plan/CURRENT-STATUS.md), 이전 분석 원문은 [audit tasks](docs/ai-seo-audit/tasks.md), Reader 작업 기록은 [reader tasks](docs/reader-experience/tasks.md)에 있다. 이전 문서의 완료 표시는 당시 범위이며, 이 목록의 배포 완료를 뜻하지 않는다.

## 1. 지금까지 들어간 변경과 남은 경계

| 영역 | 현재 통합본에 들어간 변경 | 아직 완료로 볼 수 없는 부분 |
|---|---|---|
| 메모장 / R01 | 작성 중심 레이아웃, 선택적 분할 미리보기, 목차·검색·집중 모드, 저장 실패 표시 | 실제 저장소 지속성, IME·모바일 키보드, 전체 번들 회귀 |
| AI 설정 / R02 | 역할·말투·길이·언어·이미지 설정, 로컬 저장, 계정 저장과 버전 충돌 검사 | 일반 회원 인증, 계정 전환 E2E, 로컬/서버 설정 병합 |
| 독자 이미지 / R03–R04 | Chat·토론 카드, 비회원 5장/일 예약, R07-1 소유 증명·철회 반영 | 실제 provider/D1/R2 검증, 긴 작업 복구, 인증 통합·운영 검증 |
| SEO / A01 | 모든 UA 파일 분기, HTTP/MIME·캐시 처리, canonical·404/5xx·Unicode 정규화, 앱 route 대조, 단위 112개 통과 | 실제 Workers HTML 변환·잠금 의존성 타입 검사·staging 및 기존 CDN 캐시 정리 |
| 번역 / A02 | 원자적 job/outbox 접수, 같은 실행기·wake/cron, 체크포인트·임대·예약 한도, 읽기 전용 관찰/재연결, 분리 검사 97개 | 실제 D1/Hono/Zod/React/Backend SSE 통합·staging, provider 비용 검증 |
| Projects / A03 | 기존 catalog/요약으로 Markdown 68개 복구, manifest 68개, catalog fallback | YAML 파싱 회귀, fallback 재검증과 ID 일치, 빈 결과/장애 구분, 검증된 배포 입력 |
| A04–A09 | 기존 번역·SSE·이미지·SEO 기반 서비스 존재 | 해당 감사 계획의 완료 기준 대부분 미충족; 기존 기반을 버리고 중복 개발하지 않음 |

**회원 기본 이미지 20장/일은 이전 구현의 조정 가능한 제안값이다. 사용자 요구로 고정된 값은 비회원 최대 5장/일이다.** 현재 이미지 기능 flag는 꺼져 있다. 일반 회원가입은 아직 구현돼 있지 않다.

## 2. PR 공통 사전 확인

- [x] 최신 통합 ZIP의 실제 존재, SHA-256, CRC를 확인했다.
- [x] 이전 Reader 소스와 대조했다. UTF-8로 파일명을 해석하면 기존 파일 누락은 없고, 프로젝트 Markdown 68개와 SEO 테스트 파일 1개가 추가돼 있다.
- [x] 통합본의 원래 파일 1,957개를 기준으로 보존 목록을 만들었다. 불완전한 `node_modules` 사본 27개는 배포 소스 목록에서 제외한다.
- [x] 독자 이미지 정책/저장소 계약 테스트 26개를 다시 실행해 통과했다. SQLite 기반이며 HTTP E2E는 아니다.
- [x] 이전 Reader 변경과 추가 통합 변경을 합쳐 TS/TSX/JS/MJS/CJS 41개 파일의 문법을 확인했다. 전체 타입 검사나 빌드가 아니다.
- [x] 임시 디렉터리에서 현재 Projects 생성기를 실행해 manifest 항목 68개와 기존 항목의 일치를 확인했다.
- [x] A01 기준 입력·설정·남은 작업을 재확인했다. 최신 입력 1,980개 파일을 기준으로 시작했으며, 기존 Reader 기능을 재구현하지 않았다.
- [x] R07-1 입력 2,031개에서 A02를 이어 구현하고, A02 97개·R07-1 84개·이미지 26개·SEO 112개 분리 검사를 실행했다.
- [ ] workspace별 lockfile에 맞게 의존성을 설치하고 실제 타입 검사·관련 suite를 실행한다. 현재는 Vitest 및 Workers 타입 의존성이 없어 원래 suite가 시작되지 않았다.
- [ ] **게시글 원문을 확보하기 전 `generate-manifests`/prebuild로 기존 게시글 목록을 덮어쓰지 않는다.** 현재 스냅샷에는 게시글 Markdown 원문이 0개다. Projects Markdown 68개와는 다른 집합이다.
- [ ] 실제 적용 시 DB 마이그레이션 번호는 현행 목록을 확인해 정한다. 기존 `0039_reader_image_jobs.sql`을 덮어쓰거나 재번호화하지 않는다.

## 3. 작업 순서와 의존성

| 계획 PR | 우선순위 | 이번에 마무리할 것 | 현재 상태 / 선행 |
|---|---|---|---|
| A01 | P0 | SEO 자산·canonical·404·Unicode 라우팅 | 코드·단위 검사 반영; runtime/staging 미검증, 다음 재개 지점 |
| R07-1 | P0 | 익명 ID 소유 증명·철회·안전한 갱신 | 소스·분리 검사 반영; Worker/React/다중 탭·staging 미검증 |
| A02 | P0 | 공개 번역 실행·관찰·복구 계약 | 핵심 소스·97개 분리 검사 반영; 전체 runtime/staging 미검증 |
| A03 | P0 | Projects 데이터/파서/재조회/배포 입력 검증 | 68개 복구, 나머지 수정 필요 |
| A04 | P1 | 전체 글 번역·버전·검증 후 저장 | A02의 실행 계약 |
| A05 | P1 | AI 카드의 실제 점진 응답·취소·지연 측정 | 공통 request ID, 기존 SSE 보존 |
| A06 | P1 | 기존 이미지 작업의 내구성·저장 재개·승인 | 기존 reader/admin 경계, R07-1 |
| R06-1 | P1 | 관리자와 분리된 일반 회원 인증 | R07-1 및 기존 관리자 권한 회귀 검사 |
| R06-2 | P1 | 가입 시 데이터·당일 한도 이관, 설정 병합 | R06-1, R02/R03 계약, A06 |
| R07-2 | P1 | 남용 제한·공유 네트워크 UX·비용/정리 관측 | R07-1, A06 |
| A07 | P1 | 실제 본문 HTML과 단일 SEO 데이터 | A01, A04, 공개 원문 확보 |
| A08 | P2 | 사례형 Projects와 사실 기반 About | A03, 공개 가능한 최신 근거 |
| A09 | P2 | 변경 기반·비용 제한형 SEO/이미지 자동화 | A02/A04/A06/A07/R07-2 |
| A10 | P1 | 통합 회귀와 단계별 운영 반영 | 검사는 각 PR과 병행, 배포는 대상 PR 완료 후 |

권장 흐름은 `A01 → A02 → A03 → A04`이며, A01·A03 및 R07-1처럼 변경 파일이 독립적인 작업은 병행할 수 있다. A05/A06은 기존 계약을 먼저 고정한 뒤 병행한다. A09는 선행 작업과 예산 검증이 끝나기 전 생성 기능을 켜지 않는다.

## PR-A01 — 검색봇과 사용자가 같은 자산과 올바른 페이지를 받게 한다

**현재:** A01 소스 반영과 Node 분리 테스트 112개 통과. 실제 Workers·staging 검증은 미완료. 아래 [x]는 코드/명시한 검사 범위이며 운영 완료 표시가 아니다.

주요 파일: `workers/seo-gateway/src/index.ts`, `post-resolver.ts`, `meta-rewriter.ts`, `types.ts`, `test/gateway-routing.test.ts`, 해당 Worker 테스트 설정.

- [x] 자산/제어 파일 분기를 crawler 판별보다 먼저 실행한다. robots, sitemap, RSS, manifest, JS/CSS, 이미지, Markdown을 HTML shell로 바꾸지 않는다.
- [x] `/robots.txt`·`/sitemap.xml` 및 변경 가능한 이미지/문서는 해시된 번들처럼 1년 immutable로 보내지 않는다. origin 선택과 캐시 정책을 별도로 결정한다.
- [x] 정상 origin MIME·상태·검증 헤더를 보존하고, 누락된 MIME 보완과 잘못된 본문 변환을 구분한다. GET/HEAD/조건부 요청의 동작을 검사한다.
- [x] 실제 route/manifest와 알려진 정적 파일 규칙으로 경로를 판단한다. 확장자처럼 보이는 글 slug, `/post/` 페이지, simulator HTML을 혼동하지 않는다.
- [x] `/projects` self-canonical을 추가한다. 한글·공백 slug는 한 번의 decoding과 Unicode 정규화 후 공개 manifest와 비교하며 경로 이동·제어문자는 거절한다.
- [x] manifest에 없는 글은 404, origin 일시 장애는 해당 5xx로 구분한다. 장애를 홈 200이나 영구 삭제 404로 숨기지 않는다.
- [x] canonical·description 등의 소유 태그를 중복 없이 교체한다. 기존 canonical 유무에 관계없이 하나만 남긴다.
- [x] 실제 HTMLRewriter를 사용할 수 있는 테스트 환경을 연결한다. `test:runtime`은 Miniflare/workerd로 분리하고 `npm test`에서 필수 실행한다. 테스트 연결과 실제 실행 성공은 구분한다.

분리 검사 결과 및 남은 완료 조건:
- [x] Googlebot/Bingbot/일반 UA × robots/sitemap/RSS/JS/CSS/PNG/manifest에 같은 MIME·본문·상태가 나온다 (fixture fetch 기반 단위 검사).
- [x] `/projects` canonical이 홈이 아니며, 공개 한글 slug가 실제 제목으로 해석된다 (resolver/handler 단위 검사; 실제 HTML은 아래 단계).
- [x] 미존재 글 404, origin 503, dotted slug, 이중 인코딩, canonical 중복 handler fixture가 통과한다 (실제 parser 검사와 구분).
- [ ] 실제 Worker HTML 변환 suite와 staging 응답을 확인한다. 테스트 연결은 추가했으나 실행 환경의 의존성 부재로 미검증이다.

되돌리기: Worker revision 단위로 되돌리되, 확인되지 않은 빈 manifest나 잘못된 crawler 전용 응답을 새 정상 결과로 저장하지 않는다.

**다음 실행:** `workers/seo-gateway`에서 `npm ci && npm run verify`, 이후 실제 staging origin/캐시 확인. 상세 기록: `verification/seo-a01/`. 실제 runtime/staging 통과 전 A01을 전체 완료로 표시하지 않는다.

## PR-R07-1 — 익명 ID를 알고 있다는 이유만으로 같은 소유자가 되지 않게 한다

**현재 → 목표:** ID-only 발급과 실패 후 자동 새 주체 발급을 제거했다. 유효한 기존 자격으로만 같은 주체를 유지하고, 만료/철회/저장소 장애를 구분한다. 소스·분리 검사는 반영했지만 전체 운영 완료는 아니다.

- [x] 새 ID는 서버가 정한다. `existingId`가 있으면 정규 익명 access proof와 주체 일치를 요구한다.
- [x] ID/fingerprint/IP만으로 개인 데이터 소유권을 인정하지 않는다.
- [x] exp/nbf·header·issuer/audience·용도를 검사하고, 0040의 주체 전체 철회 표식을 조회한다. 만료·철회·분실에는 ID-only 복구를 제공하지 않는다.
- [x] 기존 유효한 정규 익명 토큰(기존 jti 없는 토큰 포함)은 같은 sub로 갱신한다. 메모/이미지 owner hash와 guest 5장 ledger는 그대로 둔다.
- [x] React와 memo의 갱신 로직을 공유하고, 일시 실패 시 자격을 지우지 않는다. 늦은 응답과 이전 주체의 대기 요청이 다른 소유자로 이어지지 않게 한다.
- [x] 명시적 확인 dialog를 연결한다. 새 세션은 데이터 삭제/이관/회원가입이 아니며 실패한 저장·생성을 자동 재실행하지 않는다.
- [x] 회원 요청 실패 시 guest 자동 재시도를 제거한다. 메모 helper, 이미지/설정 middleware와 두 origin 프록시 경로에 검증을 연결한다.
- [x] UI 이벤트에는 code만 전달하고, 철회 저장소에는 주체 digest와 시각만 저장한다. 원문 자격/개인 콘텐츠를 새 진단 로그에 남기지 않는다.

검증 결과와 남은 완료 조건:
- [x] 분리 검사 84개: 실제 WebCrypto + 생산 SQL/SQLite, 서비스 함수·middleware, 100회 발급/갱신/초기 호출 합류, 거절·장애·철회·주체 변경을 검사했다.
- [x] 메모장 DOM fixture 6개: 실제 component + memory Storage/fetch/asset-loader fixture. 실제 지속성·다중 탭 검증과 구분한다.
- [x] 기존 SEO 112개, 독자 이미지 계약 26개 회귀 검사가 통과했다.
- [ ] 실제 Workers/Hono/D1 통합 테스트 6개 및 기존 관리자 TOTP/OAuth·메모·이미지 suite를 실행한다. 의존성과 누락된 `routes/secrets` 원본 모듈이 필요하다.
- [ ] 실제 React dialog 렌더·취소·포커스·회원 전환 및 전체 frontend bundle을 확인한다.
- [ ] 실제 브라우저 localStorage 지속성·Web Locks·여러 탭을 확인한다. 현재 환경의 navigation 차단으로 미검증이다. 미지원 브라우저의 cross-tab 원자성을 보장하지 않는다.
- [ ] staging에서 0040을 먼저 적용하고 origin 직접 접근 차단과 실제 발급/갱신/철회/읽기/변경을 확인한다.
- [ ] 이미 취약 경로에서 발급됐을 가능성이 있는 자격의 대응 정책을 운영자가 확인한다. 이 패치는 소급 소유 증명이나 실제 침해 확인이 아니다.

되돌리기: ID-only 발급을 다시 열지 않는다. 자격 저장소 문제는 503으로 알리고 개인 데이터와 철회 표식을 유지한다. 이미 인증된 진행 중 작업의 소급 취소는 제공하지 않는다.

다음 확인: [배포 순서](docs/anonymous-r07-1/DEPLOYMENT.ko.md). 일반 회원가입·이관은 R06, 발급 남용/공유 네트워크 UX는 R07-2로 남긴다.

## PR-A02 — 공개 번역 요청, 실제 실행, 상태 조회를 한 작업으로 연결한다

**현재:** 핵심 제품 소스 및 97개 분리 검사 반영. 0041, 실제 D1/Hono/Zod/React/Backend 연결과 staging 검증 전이므로 운영 완료가 아니다. 자세한 파일 목록과 결과는 `verification/translation-a02/`에 있다.

- [x] 공개/internal/warm 요청을 기존 translation_jobs와 domain_outbox의 단일 실행기로 연결한다. job/outbox는 원자적으로 기록한다.
- [x] waitUntil에는 짧은 wake만 남기고 Backend의 내부 SSE 관찰 및 매분 cron을 같은 D1 drain에 연결한다. 별도 영속 큐를 만들지 않는다.
- [x] 동일 원문 버전·언어 요청을 합치고 GET·status·재연결이 terminal 실패를 다시 실행하지 않게 한다. 명시적 새 revision은 관리자와 안정적인 키를 요구한다.
- [x] 저장된 단계는 재사용하며, 공급자 제출 결과가 불명확한 중단은 RESULT_UNKNOWN으로 남긴다. 확실한 제한/제출 전 실패만 최대 3회로 재개한다.
- [x] 동시 claim·전역 일별 시도·글별 시도·보수적 예약 단위 상한을 SQL에서 검사한다. 이미지 5장 정책과 분리한다.
- [x] warm/interactive 허용을 분리하고 실제 claim에 priority/오래된 작업 우선 조건을 적용한다. 경합한 interactive도 우선순위를 올린다.
- [x] 응답/선언/프런트 parser에 queued/deferred/running/succeeded/failed와 top-level job, 중첩 error.code를 연결한다. shared 실제 Zod suite 실행은 아래 미완료 조건으로 남긴다.
- [x] 공개 status는 현재 공개 원문과 요청 범위를 검증하고, 공개 URL 및 허용된 오류 메시지만 반환한다.
- [x] 한글·공백·밑줄·점 slug를 동일한 정규화로 처리하고 제어문자·경로 이동·이중 인코딩을 거절한다.
- [x] 관찰 종료는 paused로 표시하고 원문/받은 번역을 유지한다. 새로 생성하지 않는 상태 확인·job ID 재연결·취소된 관찰의 늦은 응답 차단을 연결한다.
- [x] Backend가 maxTokens/timeout을 실제 옵션으로 전달하도록 수정한다. 단계 idempotency key는 동일한 남은 시간 계산 때문에 충돌하지 않는다.
- [x] 긴 원문을 잘라 저장하는 경로를 제거한다. 현재 30,000자 초과는 생성 전 차단이며, 전체 긴 글 번역은 A04다.

검사와 남은 완료 조건:
- [x] 분리 검사 97개: 서버 66, 관찰 모듈 13, dispatch 8, Backend callback 옵션 10. 동일 요청 100회, SQLite 독립 연결 경합, legacy migration/handoff, 실행 중단·확실/불명확 실패, private status, stale write 차단을 검사했다.
- [x] 기존 R07-1 84개·이미지 계약 26개·SEO 112개 회귀 검사 재통과. 실제 runtime 검사와 구분한다.
- [ ] 잠금 의존성·누락된 secrets 원본을 결합하고 API Worker 타입 검사와 Hono/D1 테스트 21개, shared Zod 검사 6개, 프런트 parser/화면 및 전체 관련 suite를 실행한다.
- [ ] staging에서 0041을 실제 D1에 적용하고 기존 작업/캐시 보존·동시 admission·claim·rollback을 검증한다. 구 번역 바이너리 혼합 쓰기를 금지한다.
- [ ] 실제 Backend–Worker SSE, origin 인증, buffering/idle timeout, cron 등록, Backend 강제 종료 후 같은 job 복구를 검증한다.
- [ ] 실제 브라우저 sessionStorage/여러 탭/언어 전환/포커스/네트워크 복구와 기존 사용자·관리자 권한을 확인한다.
- [ ] 원본 SDK 재시도/실제 model usage를 측정해 예약 예산을 보정한다. 현재 예약은 실청구 토큰이나 통화 비용이 아니다.
- [ ] Legacy 동기 소비자의 202 전환과 원문 body 우회 제거를 실제 호출 통계에 맞춰 확인한다.

되돌리기: 신규 실행 flag를 끄고 기존 cache와 job/checkpoint를 보존한다. 0041 적용 뒤 구 바이너리를 무조건 재배포하지 않는다. RESULT_UNKNOWN은 기록 확인 없이 자동 재생성하지 않으며 R07-1의 ID-only 발급을 다시 열지 않는다.

**재개 지점:** 위 실제 환경 검증이 가능하면 먼저 완료한다. 환경이 여전히 막혀 있으면 A03의 독립적인 Projects 파서·배포 입력·재조회 복구를 구현하되 A02를 운영 완료로 표시하지 않는다. A04는 이 전달본의 실행 계약을 기준으로 긴 글/구조/모델 버전을 보강한다.

## PR-A03 — Projects 복구 결과를 안정적인 배포 입력으로 만든다

**현재 → 목표:** catalog로 복구한 68개는 유지하되, 정상 YAML 입력이 변형되거나 일시적인 fallback이 계속 고정되는 상태를 없앤다.

주요 파일: `frontend/scripts/generate-projects-manifest.js`, `rebuild-github-project-data.mjs`, `project-catalog-summaries.json`, `public/project-data/`, `public/projects-manifest.json`, `src/services/content/projectService.ts`, `src/pages/public/Projects.tsx`, `package.json`, CI.

- [ ] 기존 gray-matter 수준의 YAML 호환 파서를 복원하거나 동등한 검증된 파서로 통합한다. 의존성 설치가 안 된다는 이유로 줄 단위 JSON 파서로 의미를 바꾸지 않는다.
- [ ] 일반 build와 catalog 기반 복구를 분리한다. 누락 입력을 build 중 조용히 재생성하지 않고 명시적인 복구 작업과 근거를 남긴다.
- [ ] catalog의 공개 범위·pinned commit·검토 요약과 모든 항목을 비교한다. 일부 summary 누락을 조용히 걸러내 성공 처리하지 않는다.
- [ ] 기존 `--check`와 현재 복구 형식의 차이를 정리한다. 원본 `repositories.json`/`evidence.json`이 없다면 이를 확보하거나, catalog 복구 검증 계약을 별도로 명시한다. 없는 GitHub 검토 증거를 재구성해 원본처럼 표시하지 않는다.
- [ ] missing/extra/duplicate ID, 파싱 실패, 공개 범위 변경, 의도되지 않은 빈 목록을 배포 전에 차단한다. 의도적인 전체 제거에는 확인 가능한 변경 기록을 요구한다.
- [ ] manifest를 임시 후보로 검증한 뒤 교체한다. 실패하면 이전 정상 목록 파일을 유지한다.
- [ ] 네트워크 전면 실패와 합법적인 빈 목록을 API/UI 상태에서 분리한다. 마지막 정상 목록이 있으면 남기고 오류/재시도를 표시한다.
- [ ] catalog fallback의 출처·임시 상태를 유지하고 정상 manifest를 다시 조회한다. fallback과 기본 manifest는 같은 stable ID를 사용한다.
- [ ] 매 요청 `Date.now()` cache-bust를 제거하고 release version 또는 HTTP validator로 검증한다. 재시도 버튼은 실제 재조회해야 한다.

완료 조건:
- [ ] 현재 입력 기준 68개가 정확히 한 번씩 포함된다. 이는 제공 catalog의 수이며 실시간 GitHub 목록을 검증한 수가 아니다.
- [ ] YAML block list·multiline description·따옴표·CRLF fixture가 의미를 유지한다. 현재 `description: |`가 문자 `|`, tags가 빈 배열로 되는 재현을 고친다.
- [ ] manifest 503 → fallback → 정상 manifest 복귀 시 stable ID와 최신 내용이 복구된다. 양쪽 503은 빈 성공으로 숨기지 않는다.
- [ ] 누락/중복/파싱 실패가 있는 생성기는 기존 manifest를 덮어쓰지 않고 실패한다.

되돌리기: 검토된 원본 catalog와 이전 정상 manifest를 함께 보관한다. 단순 count 68 확인만으로 복구·공개 범위 검증 전체를 대신하지 않는다.

## PR-A04 — 긴 번역을 생략 없이 만들고 검증된 현재 버전만 저장한다

**현재 → 목표:** A02에서 제목·설명·본문·언어의 SHA-256, 단계 저장, 임대/새 revision 쓰기 차단과 긴 글 사전 거절을 반영했다. 이를 모델 버전까지 포함한 계약, 전체 Markdown 블록 번역, 구조·품질 검증으로 확장한다.

주요 파일: `workers/api-gateway/src/lib/translation-service.ts`, A02 job/outbox 코드, shared translation 계약, D1 마이그레이션, 번역 fixture/tests.

- [ ] A02의 제목·설명·본문·언어·정책 SHA-256에 실제 model route/version·prompt/schema 계약을 완성한다. 32비트 compatibility helper는 현재 번역 원장에 쓰지 않으며 최종 소비자 정리를 검증한다.
- [x] A02의 0041에서 source_version을 기존 cache와 공존하도록 추가했다. 기존 본문은 보존하고 현재 버전 검증과 분리한다 (실제 migration 검증은 A02 배포 조건).
- [ ] Markdown 블록 단위로 전체 본문을 번역한다. 코드·URL·표·이미지·footnote·문단 anchor를 보존하고 조각 순서/중복을 검사한다.
- [ ] 짧은 제목·설명을 묶고 제한된 병렬 처리를 적용한다. 공급자 한도 및 전체 deadline을 넘는 무제한 fan-out은 금지한다.
- [ ] 각 조각의 누락·구조·링크·코드 보존 여부를 검사하고 불완전 결과를 후보/실패로 남긴다. 글자 길이 비율만으로 번역 품질을 확정하지 않는다.
- [ ] A02의 임대/접수된 최신 revision 원자적 쓰기 조건에 더해, 외부 원문 저장·공개 전환과 artifact 게시 사이의 원자성 및 원문 버전 되돌림 정책을 완성한다.
- [ ] 캐시 삭제/명시적 다시 생성의 revision 정책을 job/outbox와 연결한다. 네트워크 재시도와 새 생성 의도를 분리한다.

완료 조건:
- [ ] 50,000자 원문이 잘리지 않으며 100자 부실 결과는 정상 캐시에 저장되지 않는다.
- [ ] 제목만 변경·설명만 변경·언어/정책 변경 시 해당 결과가 올바르게 갱신된다.
- [ ] N 버전의 늦은 완료가 N+1 캐시를 덮어쓰지 않고, source 비공개 전환도 공개 저장을 차단한다.
- [ ] 코드/표/링크/이미지/footnote fixture와 삭제 후 재생성·중복 재시도가 통과한다.

되돌리기: 새 버전의 생성/승격을 정지하고 이미 검증된 공개 결과를 유지한다. 마이그레이션 후 이전 binary로 돌아갈 수 있는 읽기 호환성을 기록한다.

## PR-A05 — 카드도 실제 답변이 오는 대로 보여주고 취소를 끝까지 전달한다

**현재 → 목표:** 일반 Chat의 실제 SSE는 유지하고, sketch/prism/chain의 전체 응답 대기 및 실패 후 추가 대기를 줄인다.

주요 파일: `frontend/src/services/discovery/ai.ts`, `components/features/sentio/` 관련 hook/component, `backend/src/routes/chat.js`, `backend/src/lib/chat-streaming.js`, AI service/provider adapter, Worker AI routes.

- [ ] 같은 request ID로 문맥 조회·provider 요청·첫 유용한 내용·완료·화면 표시를 기록한다. heartbeat는 답변 도착으로 세지 않는다.
- [ ] 카드에 검증된 item/delta event를 도입한다. 불완전 JSON을 완성 문장처럼 표시하지 않는다.
- [ ] 기존 notebook/RAG 병렬 제한과 실제 Chat 스트리밍을 보존한다.
- [ ] `/ai/generate/stream`의 완성 후 타자 효과를 실제 stream으로 바꾸거나, 소비자/호환성 확인 후 중복 경로를 정리한다.
- [ ] 전체 deadline과 AbortSignal을 provider까지 전달한다. 취소 후 fallback 생성이 새로 시작되지 않도록 한다.
- [ ] 접기/이동에 따른 관찰 중단과 실제 생성 취소를 분리하고, 부분 응답/재연결에서 중복 텍스트를 막는다.
- [ ] 상단의 반복 설명 대신 작은 상태·취소/재연결 조작을 사용한다. 사용자가 위로 읽고 있으면 자동 스크롤을 멈춘다.

완료 조건:
- [ ] provider의 첫 유용한 item이 전체 완료를 기다리지 않고 나타난다.
- [ ] 취소 후 새로운 upstream 호출이 없고, partial failure에도 받은 내용이 유지된다.
- [ ] 동일 입력·모델·캐시 조건에서 p50/p95를 비교한다. 측정 전에는 속도 개선 완료로 표시하지 않는다.

되돌리기: 새 카드 stream 계약만 되돌리고 기존 정상 Chat SSE·저장된 대화·부분 응답을 보존한다.

## PR-A06 — 이미지 생성과 저장을 복구 가능한 작업으로 완결한다

**현재 → 목표:** 독자 이미지의 예약/중복 방지/비공개 저장과 관리자 생성 어댑터를 유지하면서, 장시간 요청 종료 후에도 생성과 업로드를 구분해 복구한다.

주요 파일: `workers/api-gateway/src/routes/reader-images.ts`, `lib/reader-image-*.ts`, `backend/src/routes/readerImageRender.js`, `adminAiImages.js`, `services/ai-image/*`, `services/agent/tools/image-generation.tool.js`, `frontend/src/services/personal/readerImages.ts`, `services/session/adminImages.ts`, `GeneratedImageCard.tsx`, 관리자 생성 패널.

- [ ] 실제 AI-server 계약에서 endpoint·인증·모델 별칭·지원 옵션·오류·provider request ID를 확인한다. 모델 목록 조회 성공을 생성 성공으로 표시하지 않는다.
- [ ] 기존 job/repository 경계에 접수→생성→검증→저장→완료를 연결한다. 기존 최초 독자 요청은 결과를 기다리고 있으므로 202 응답만 추가한 것으로 장기 실행 완료를 선언하지 않는다.
- [ ] 동일 생성 의도의 idempotency key를 화면 재연결·관리자 재시도까지 유지한다. 명시적인 새 이미지 요청에만 새 키를 만든다.
- [ ] 생성 성공 후 업로드 실패는 원본/결과 참조를 복구해 업로드부터 재개한다. 이미 생성한 이미지를 다시 유료 생성하지 않는다.
- [ ] 결과 불명확 작업은 provider 조회/저장 객체 확인/운영자 검토로 정리한다. 근거 없이 자동 환불·자동 재생성하지 않는다.
- [ ] 기존 PNG/raster decode, 픽셀·바이트 제한, remote 응답 검증, 요청 서명, private owner 검사를 보존한다.
- [ ] 독자 개인 이미지와 공개 게시글 이미지의 소유/저장/승인 경계를 분리한다. 같은 생성 어댑터를 재사용해도 개인 결과가 공개 CDN/SEO로 섞이면 안 된다.
- [ ] Unicode slug는 stable post ID와 충돌 없는 저장 경로로 연결한다. 수동 cover 잠금·원문 버전·승인된 후보만 게시하는 규칙을 admin/agent에 동일 적용한다.
- [ ] 성공·예약·확실한 실패·불명확 결과를 사용량과 대조하고 7일 보관/cleanup/orphan 회수의 실제 실행을 검증한다.

완료 조건:
- [ ] 응답 유실·worker 재시작·업로드 실패 후 동일 요청을 복구하며 provider 생성 횟수가 불필요하게 늘어나지 않는다.
- [ ] 다른 소유자는 읽지 못하고, 비회원 6번째 생성은 원자적으로 제한된다. KST 자정 및 동시 요청도 포함한다.
- [ ] 실제 AI-server/D1/R2와 예산이 승인된 최소 샘플을 검사한다. 테스트용 mock 결과로 운영 완료 처리하지 않는다.
- [ ] 관리자 후보 저장은 공개 cover 변경과 별개이며 실패 시 이전 이미지가 유지된다.

되돌리기: 새 생성 접수 flag를 끄되 안전하게 저장된 기존 결과의 허용된 읽기와 job 장부는 보존한다. 새 마이그레이션/작업 상태와 이전 코드의 호환 경계를 기록한다.

## PR-R06-1 — 관리자 권한과 분리된 일반 회원 인증을 추가한다

**현재 → 목표:** 관리자/익명 중심 인증에서, 일반 회원이 검증된 계정으로 자신의 AI 설정과 이미지를 관리하는 상태로 확장한다.

주요 파일: Worker 인증 route/JWT/인증 middleware, 사용자 계정 저장소와 additive migration, 프런트 세션 store·회원가입/로그인 화면, 인증 E2E.

- [ ] 일반 회원 가입/로그인 흐름을 별도로 구성한다. 기존 관리자 allowlist·email verification·관리자 전용 route는 완화하지 않는다.
- [ ] 이메일 또는 선택한 identity provider의 검증 상태를 서버가 확정한다. 클라이언트 role/tier 값으로 회원이나 관리자가 되지 않게 한다.
- [ ] access/refresh, 회전·철회, 비활성화, 탈퇴 후 접근 정책을 구현한다.
- [ ] 검증된 회원 판정을 image policy와 agent preferences에 일관되게 적용한다. 미검증 계정은 회원 한도를 우회하지 못한다.
- [ ] 가입 실패/중복 가입/로그인 만료 시 입력과 기존 익명 데이터를 보존한다. 이 PR에서는 자동 데이터 이관을 하지 않는다.

완료 조건:
- [ ] 비회원·미검증 회원·검증 회원·관리자의 허용 범위가 각각 테스트된다.
- [ ] 일반 회원이 관리자 API를 사용할 수 없고, 계정 전환/탈퇴 후 이전 개인 결과 접근이 차단된다.
- [ ] 기존 관리자 로그인과 익명 메모/대화가 정상 동작한다.

되돌리기: 신규 가입을 중지하고 기존 계정을 보존한다. 회원을 관리자나 익명 계정으로 강제 전환하지 않는다.

## PR-R06-2 — 가입할 때 필요한 데이터와 사용량만 안전하게 이어받는다

**현재 → 목표:** guest/member가 별도 주체라 당일 한도와 설정이 나뉘는 상태에서, 검증된 동의와 중복 방지 이관 기록으로 연속성을 제공한다.

주요 파일: 회원/익명 identity 저장소, `reader_image_jobs` 연계 장부, 메모/대화/개인 이미지 소유권 처리, `agentPreferences.ts`, `AgentPreferencesDialog.tsx`, 이관 API·E2E.

- [ ] 기존 guest 소유 증명과 로그인 계정을 함께 검증한 뒤 사용자가 선택한 데이터만 이관한다. 공개 fingerprint나 ID만으로 이관하지 않는다.
- [ ] 같은 날짜 guest 소비량이 가입 후 사라지지 않도록 회원 사용량에 한 번만 연결한다. 새 과금 이벤트를 만들거나 원본 기록을 삭제해 합계를 맞추지 않는다.
- [ ] 같은 guest 사용량을 여러 계정으로 반복 이전하지 못하게 이관 uniqueness/감사 기록을 둔다. 실패한 이관은 중복 반영 없이 재개한다.
- [ ] 동일 네트워크의 다른 guest 사용량은 해당 사람의 계정으로 옮기지 않는다.
- [ ] 메모·대화·이미지 소유권과 보관 기한, 삭제/내보내기 정책을 일치시킨다. 자료 없음·현재 흐름에서 제외·실제 삭제를 구분한다.
- [ ] 로컬 전용 AI 설정과 계정 설정의 차이를 표시하고 사용자가 병합/선택하도록 한다. CAS 충돌을 조용히 덮어쓰지 않는다.

완료 조건:
- [ ] guest 5장 사용→가입→동일 날짜 회원 예산 적용 시 중복 무료 한도가 생기지 않는다. 회원 한도 값은 정책 설정을 따른다.
- [ ] 이관 중 재시도·동시 가입·계정 전환에서 데이터 유실/중복 소유/이중 사용량 반영이 없다.
- [ ] 이관 전후 메모 버전과 개인 이미지 읽기 권한이 일치한다.

되돌리기: 아직 확정하지 않은 이관은 원래 소유를 유지한다. 이미 확정된 이관은 감사 기록을 통한 보상 절차 없이 임의로 역복사하거나 장부를 삭제하지 않는다.

## PR-R07-2 — 이미지 남용 제한과 운영 관측을 보강한다

**현재 → 목표:** 비회원/네트워크/전역 수량 제한을 보존하고, 공유 네트워크 오인·분산 요청·정리 지연을 구분해 운영한다.

주요 파일: `reader-image-policy.ts`, 이미지/인증 admission, 관리 상태 화면, reader retention scheduler, 검증된 비용/usage 수집 경로.

- [ ] Turnstile 등 추가 검증을 요청 위험과 상황에 맞춰 연결한다. 정상 방문마다 큰 안내를 상시 추가하지 않는다.
- [ ] 공유 NAT·IPv6·다중 토큰/네트워크 상황의 제한 정책을 정하고 서버에서 집행한다. 브라우저 저장소만으로 하루 5장을 보장한다고 표현하지 않는다.
- [ ] 사용자의 남은 수량, 네트워크 제한, 전역 제한, 일시적 burst 제한을 서로 다른 상태로 표시한다.
- [ ] 생성/업로드/불명확 결과와 실제 usage를 대조하고 제한된 운영자 복구·정산 경로에 감사 기록을 남긴다.
- [ ] cleanup backlog, 오래된 예약, unknown 결과, 비용/스토리지 상한을 관리자에서 확인한다. provider 조회 기능은 A06을 재사용한다.

완료 조건:
- [ ] 동시성·토큰 재발급·공유 네트워크 fixture에서도 비회원/전역 제한이 예상대로 적용된다.
- [ ] 예산 또는 운영 상한 소진 시 새 생성이 멈추고, 정상 기존 결과가 삭제되거나 공개되지 않는다.
- [ ] 정상 사용자의 제한 사유와 다음 가능한 동작을 짧게 보여준다.

되돌리기: 새 challenge 정책을 완화하더라도 기존 서버 한도·소유 검사를 제거하지 않는다. 미확인 비용을 성공/무료로 바꾸지 않는다.

## PR-A07 — 공개 본문 HTML과 모든 SEO 출력을 같은 데이터에서 만든다

**현재 → 목표:** 메타 태그만 바꾸는 static shell과 여러 생성 규칙을 실제 공개 본문이 있는 버전별 산출물로 통합한다.

주요 파일: `frontend/scripts/generate-static-html.js`, `generate-seo.js`, `src/hooks/seo/useSEO.ts`, `src/utils/seo/seo.ts`, 공개 route/manifest, SEO gateway.

- [ ] 원문/프로젝트/검증된 언어 버전의 PageArtifact 계약을 정하고 HTML·JSON-LD·OG·canonical·sitemap을 같은 버전에서 생성한다.
- [ ] 확보한 실제 공개 원문을 prerender/SSG로 출력한다. 원문이 없는 현재 snapshot으로 글 내용을 만들어 채우지 않는다.
- [ ] gateway가 실제 path artifact를 제공하고 client render 이후에도 본문 의미와 링크/이미지가 유지되게 한다.
- [ ] canonical·article metadata·JSON-LD를 route별 소유 범위에서 정리한다. 다른 페이지의 `article:tag`가 누적되지 않게 한다.
- [ ] inline JSON의 `<`/script 종료 경계를 안전하게 직렬화하고 합성 입력으로 검증한다.
- [ ] 실제 의미 있는 수정일, 저자 URL, 이미지 치수를 사용한다. 빌드 날짜로 모든 글을 새로 수정한 것처럼 만들지 않는다.
- [ ] 검증된 번역 URL에만 self-canonical·상호 hreflang을 연결하며 sitemap은 공개·검증된 canonical만 포함한다.

완료 조건:
- [ ] JS 없이 받은 HTML에 실제 글 내용·주요 링크·img src가 있다.
- [ ] canonical 1개, 현재 route의 metadata만 존재하며 client와 구조/내용이 일치한다.
- [ ] 비공개/원문 누락/미검증 번역이 공개 HTML이나 sitemap에 들어가지 않는다.

되돌리기: 이전 정상 artifact와 route manifest를 함께 복구한다. framework 전체 교체나 검증 전 신규 언어 URL 공개는 이 PR의 선행 조건이 아니다.

## PR-A08 — Projects 사례 페이지와 About의 확인된 내용을 갱신한다

**현재 → 목표:** 전체 공개 저장소 목록은 유지하면서, 확인된 대표 작업과 본인의 역할/결과를 별도 사례로 설명한다.

주요 파일: Projects/About 페이지, 프로젝트 상세 route·데이터 스키마·작성 원문, 저자/언어별 소개 데이터.

- [ ] 대표 사례 4–6개와 전체 catalog를 분리하고, stable slug 상세 페이지를 추가한다.
- [ ] fork·empty·public·구현 여부·운영 확인 상태를 구분한다. 공개 저장소를 완료 서비스로 바꾸어 표시하지 않는다.
- [ ] 문제·직접 한 일·설계 선택·실패와 복구·결과 근거·마지막 확인일·실제 화면을 사례에 연결한다.
- [ ] AI-server/WLatch/파일 앱 등 다른 프로젝트는 해당 최신 자료와 공개 허용 범위를 확보한 뒤 작성한다.
- [ ] About의 졸업 예정·경력·기술 경험은 사용자/자료로 확인한 사실만 갱신한다. 날짜나 commit만으로 졸업/전문성/사업 성과를 추론해 확정하지 않는다.
- [ ] 한국어/영어 소개와 author URL을 맞추고, 상단의 불필요한 장식 문구/반복 설명을 늘리지 않는다.

완료 조건:
- [ ] 공개 사실과 수치에 확인 가능한 근거·범위가 연결된다.
- [ ] 대표 작업·코드·연락 경로가 쉽게 보이며 기존 전체 catalog가 누락되지 않는다.

되돌리기: 데이터/콘텐츠 변경 단위로 되돌린다. 확인되지 않은 문장은 검토 후보로 남기고 공개 이력에 넣지 않는다.

## PR-A09 — 공개 콘텐츠의 변경에만 제한된 SEO/이미지 작업을 실행한다

**현재 → 목표:** 기존 outbox/생성 기반을 재사용해 변경이 필요한 공개 산출물만 예산 안에서 준비하고 검증 후 게시한다.

주요 파일: 게시/수정 이벤트 경계, 기존 artifact outbox/scheduler, A06 image job, A07 PageArtifact, 운영 관측 화면.

- [ ] PostPublished/PostUpdated/ProjectUpdated에서 원문 버전과 공개 범위를 확정한 뒤 산출물 차이를 계산한다.
- [ ] deterministic metadata/링크 검사와 유료 AI 후보 생성을 분리한다. 140개 공개 글/88개 이미지 미지정은 기존 snapshot 집계이지 일괄 생성 승인이 아니다.
- [ ] 텍스트 전용·수동 이미지 잠금·변경 없는 콘텐츠·비공개 데이터를 제외한다.
- [ ] source/policy/prompt/artifact 버전, locale, idempotency key, 단계·비용·retry·실행 소유권을 기존 장부와 연결한다.
- [ ] 생성/변환/업로드/검증/게시를 나눠 재개하고 늦은 결과는 현재 버전을 덮어쓰지 않게 한다.
- [ ] 일별/월별 비용·토큰·이미지 수·저장공간·재시도 상한을 실제 usage와 대조한다. 가격/할당량은 구현 시 실제 AI-server 계약에서 확인한다.
- [ ] 전경 요청 지연·provider 실패·예산 소진 시 배경 생성을 pause/defer하고 이유를 관리자에게만 표시한다.
- [ ] 접근이 연결된 경우에만 Search Console 자료를 수집한다. 검색 순위/색인/CTR 개선을 생성량만으로 보장하거나 확정하지 않는다.

완료 조건:
- [ ] 같은 입력을 재처리해도 불필요한 provider 재생성이 없다.
- [ ] 새 후보/게시 실패 시 이전 본문·이미지·SEO가 유지된다.
- [ ] 예산/전경 우선순위/수동 잠금이 실제 동시 실행에서도 유지된다.

되돌리기: 배경 작업 접수와 공개 반영을 별도로 끈다. 검토 전 후보를 현재 게시물로 강제 승격하지 않는다.

## PR-A10 — 통합 회귀와 단계별 배포를 완료한다

**현재 → 목표:** 개별 코드/SQLite 확인과 과거 메모 UI 기록을 실제 통합 경로·기기·배포 환경에서 확인한 상태로 만든다. R01–R05의 미완료 검증을 이 PR에 연결한다.

주요 범위: workspace build/typecheck/tests, CI, 메모/Chat/토론/번역 E2E, 인증/이미지/D1/R2 계약, 배포 문서와 원복 절차.

- [ ] 의존성 설치 후 frontend·backend·shared·Workers의 관련 원래 suite 및 타입 검사를 실행하고 실패를 수정한다. 통과한 일부 script를 전체 test 성공으로 대체하지 않는다.
- [ ] source/manifest/원문/assets/route의 같은 release 여부를 검사한다. 게시글 원문 누락·중복 프로젝트·깨진 자산 참조는 배포 전에 차단한다.
- [ ] 실제 저장소를 사용하는 메모에서 작성→저장→탭/브라우저 재시작→복원과 버전 복구를 검사한다.
- [ ] 모바일 IME/가상 키보드·화면 확대·reduced motion·긴 코드/표·검색·목차·집중 모드·저장 실패 후 닫기 보호를 검사한다.
- [ ] 계정 전환/만료·페이지 이동·중복 클릭·연결 단절·원문 수정과 늦은 응답을 조합해 메모/대화/번역/이미지 혼선을 검사한다.
- [ ] 개인 메모/대화/이미지와 공개 SEO/추천/agent 입력의 경계를 검사한다. CSP·로그·외부 이미지 fetch·인증 서명을 별도로 점검한다.
- [ ] 오래된 translation API Sunset(2026-06-30)은 실제 호출과 호환성을 확인한 뒤 정리한다. 날짜가 지났다는 이유만으로 route를 삭제하지 않는다.
- [ ] 승인된 staging에서 migration 0039 및 후속 additive migrations, 전용 private R2/lifecycle/권한, backend/Worker 설정을 순서대로 적용한다.
- [ ] R07-1 소유 증명 수정과 A06 운영 검증을 통과한 뒤 backend/gateway image flags를 순차 활성화한다. API 키는 클라이언트에 넣지 않는다.
- [ ] 최소 실생성·중복키·다른 소유자의 읽기 거부·비회원 한도·삭제/만료·비용 대조를 확인한 후 운영 배포를 승인한다.
- [ ] 실패 작업·재시도·비용·현재 사용 자산 중심의 작은 운영 화면을 제공한다. 반복 소개 배너를 추가하지 않는다.

완료 조건:
- [ ] 배포 대상 PR의 검증 로그, release/source hash, 적용 migration, flag, 실제 provider 테스트 범위가 남는다.
- [ ] 운영 canary와 rollback을 확인한다. 새 코드+이전 manifest, 이전 코드+새 DB 등 허용하지 않는 조합을 차단한다.
- [ ] 미완료 항목이 있으면 해당 기능은 꺼진 채로 남기고 배포 범위에서 명시적으로 제외한다.

되돌리기: 검증한 revision/manifest/설정 조합으로 되돌린다. 개인 데이터·job·사용량 장부를 삭제해서 장애를 숨기지 않는다.

## 4. 공통 완료 기록

각 PR은 아래 항목을 채운 뒤 완료로 바꾼다. 이 체크리스트의 빈칸을 구현 여부와 무관하게 한꺼번에 체크하지 않는다.

- [ ] 실제 변경 파일과 이전/이후 동작, 보존해야 할 조건을 기록했다.
- [ ] 성공·확실한 실패·결과 불명확·중복·동시 변경·늦은 결과를 검사했다.
- [ ] 테스트 명령·결과·fixture·실행 환경을 첨부하고 미실행 항목을 구분했다.
- [ ] 필요한 원문/운영 설정/공개 허용 근거를 확인했다.
- [ ] 마이그레이션/feature flag/호환성/원복 경계를 기록했다.
- [ ] 실제 원격 PR 번호/commit/배포 여부가 있다면 근거와 함께 기록했다. 계획 ID를 실제 PR 번호처럼 사용하지 않았다.

### 실행 명령의 성격

`npm --prefix frontend run type-check`, `npm --prefix frontend run test:run`, `npm --prefix workers/api-gateway run typecheck`, `npm --prefix workers/api-gateway test`, `npm --prefix workers/seo-gateway run typecheck`, `npm --prefix workers/seo-gateway test`는 의존성 설치 후 실행할 기존 명령이다. 현재 통합본에서 모두 성공했다고 기록하지 않았다.

읽기 전용 재점검 스크립트는 `verification/pr-plan-20260910/review-snapshot.cjs`에 있다. 루트에서 다음처럼 실행한다. TypeScript 경로는 설치한 모듈을 가리켜야 한다.

```bash
mkdir -p /tmp/blog-pr-review
BLOG_SOURCE="$PWD" \
REVIEW_OUTPUT=/tmp/blog-pr-review \
TYPESCRIPT_PATH="$PWD/frontend/node_modules/typescript" \
node verification/pr-plan-20260910/review-snapshot.cjs
```

이 스크립트의 `diagnostics.json`에는 현재 남은 문제를 재현한 결과도 들어 있다. 진단 실행 성공과 제품 수정 완료는 다르며, 실제 Worker HTMLRewriter·브라우저 E2E·provider 통합을 대신하지 않는다.
