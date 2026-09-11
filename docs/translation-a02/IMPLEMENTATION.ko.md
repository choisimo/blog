# A02 — 번역 작업 실행·조회·복구 통합

기준일: 2026-09-10. 기준 입력: `blog-integrated-r07-1-20260910.zip`.
입력 SHA-256: `6a35bd09e50b455f7a29aed1452703e1ae050ed10ca216a85c9e04311da97e75`.

## 현재 결과

R07-1까지의 2,031개 입력 파일에서 시작했다. A01/R07-1의 미완료 운영 검증을 완료로 바꾸지 않았으며, 독립적인 A02의 실제 제품 소스를 구현했다. 운영 배포, 유료 모델 호출, 이미지 생성, DB 원격 변경은 하지 않았다. 원격 PR 생성·병합 기록이 아니라 구현 단위 A02의 전달본이다.

번역 요청은 기존 `translation_jobs`와 `domain_outbox`에 함께 기록하고, 공개·내부·배경 요청은 같은 작업에 합류한다. 상태를 조회한다고 실패 작업을 새로 실행하지 않는다. 실행 소유권, 받은 결과, 아직 결과를 모르는 호출을 구분한다. 화면 관찰의 종료도 서버 실패와 분리했다.

## 실행 흐름

```text
언어 선택
  → 원문/캐시 확인
  → 같은 원문 버전·언어의 작업 참여 또는 최초 접수
       ├─ 202 + job + 공개 status URL → 원문을 계속 읽으며 상태 관찰
       └─ 짧은 wake 신호 → Backend → Worker 내부 drain 연결 유지
                                      └─ D1 원자적 claim
                                           → 제목 / 설명 / 본문 단계 저장
                                           → 현재 원문과 실행 소유 확인
                                           → 캐시 저장 / 작업 완료

매분 scheduled drain → 같은 D1 실행기를 호출하여 유실된 wake와 중단 작업 확인
브라우저 재연결       → 같은 job status 조회 (생성 요청 아님)
```

`waitUntil`에는 모델 실행을 넣지 않고 5초로 제한한 wake 전송만 넣었다. Backend의 pump는 신호를 합치는 프로세스 내 도구이며 영속 큐가 아니다. D1이 유일한 영속 작업 원장이다. 내부 SSE 연결은 open/heartbeat/done만 보내며 글이나 번역을 포함하지 않는다. Backend가 재시작되면 연결은 사라질 수 있지만 D1 기록은 남고 scheduled가 같은 실행기로 복구한다.

Cloudflare 문서의 응답 후 `waitUntil` 수명과 D1 batch의 순차·트랜잭션 동작을 확인해 설계에 반영했다. 외부 문서는 플랫폼 동작의 근거이며 이 배포의 실행 성공을 증명하지 않는다. 참고 주소는 문서 끝에 기록했다.

## 무엇을 다르게 처리하는가

| 상황 | 처리 |
|---|---|
| 동일 원문/언어 100회 요청 | 같은 job/outbox에 합류. 동시에 접수한 warm/interactive도 한 항목을 사용하고 우선순위만 올림 |
| 내부 요청이 먼저 만든 작업을 공개 사용자가 관찰 | 서버 저장 URL을 그대로 노출하지 않고 공개 상태 URL로 다시 구성 |
| 실행을 아직 시작하지 않았거나 저장된 단계 뒤에 중단 | 임대가 끝나면 같은 ID를 deferred로 옮겨 저장된 단계부터 재개 |
| 공급자에 제출했으나 결과를 저장하지 못한 상태에서 중단 | RESULT_UNKNOWN으로 종료. GET·cron·재연결이 자동으로 재생성하지 않음 |
| 명확한 429 | 현재 호출을 실패로 기록하고, 이미 받은 단계는 유지. 작업 시도 최대 3회 안에서 지수 대기 후 재개 |
| 원문 조회 일시 장애 | SOURCE_UNAVAILABLE/deferred. 모델 제출 전 실패를 불명확한 모델 성공으로 취급하지 않음 |
| 한도 초과/다른 작업 실행 중 | 다음 허용 시각과 이유를 가진 deferred. 생성을 먼저 하고 사후 차감하지 않음 |
| 원문 변경/새 번역 revision/관리자 캐시 삭제 | 이전 실행의 캐시 쓰기를 차단. 삭제는 job 이력의 물리 삭제가 아님 |
| 공개 상태 조회 중 글이 비공개로 전환 | 404. 내부 오류/원문/자격 정보는 반환하지 않음 |
| 새로 생성 요청 | 검증된 관리자 + Idempotency-Key 필요. 같은 키의 전송 재시도는 같은 revision을 가리킴 |
| 화면 관찰 종료/네트워크 단절 | paused. 원문/받은 번역 유지, 짧은 ‘상태 확인’ 버튼 제공. AI_TIMEOUT 서버 오류로 만들지 않음 |
| 탭 복원/언어·글 전환 | job ID와 로컬 버전 표식으로 재연결. 취소된 관찰의 늦은 응답은 반영하지 않음 |

원문 버전은 제목·설명·본문·원문/대상 언어·A02 정책 버전·글 식별자를 실제 SHA-256으로 계산한다. 공급자 모델 route/version까지 포함하는 최종 버전 계약은 A04로 남아 있다. 브라우저 sessionStorage의 간단한 표식은 재연결 포인터가 해당 글에 속하는지 확인하는 로컬 보조 정보이며 서버 보안·콘텐츠 해시를 대체하지 않는다.

## 처리량과 비용 경계

아래 수치는 새 번역 경로의 조정 가능한 기본 제안값이며, 실제 성능 측정치나 사용자 요구로 고정된 비용이 아니다.

| 설정 | 기본값 | 의미 |
|---|---:|---|
| TRANSLATION_EXECUTION_ENABLED | false | 실행 활성화 전 0041·Backend·staging 검증 필요 |
| TRANSLATION_WARM_ENABLED | false | 선택적 배경 번역 별도 활성화 |
| TRANSLATION_MAX_CONCURRENT | 2 | DB가 허용하는 동시 실행 작업 |
| TRANSLATION_DAILY_ATTEMPTS | 50 | 한국 시간 하루의 실행 시도 예약 수 |
| TRANSLATION_POST_DAILY_ATTEMPTS | 6 | 글·대상 언어별 하루 시도 예약 수 |
| TRANSLATION_DAILY_TOKEN_BUDGET | 2,000,000 | 보수적으로 계산한 예약 단위 상한. 실제 청구 토큰 아님 |
| 최대 대기 작업 | 80 | 전체 queued/deferred/running 입장 제한 |
| 작업 재시도 상한 | 3 | 동일 논리 작업의 전체 시도 상한 |

예약 단위는 입력 UTF-8 바이트, 제목/설명/본문 출력 제한, 프롬프트 여유량을 더한다. SQL에서 동시성·일별/글별 예산 검사와 시도 기록을 같은 batch로 실행한다. 안전한 재개도 새 시도로 기록하므로 실제 생성량보다 보수적으로 차감될 수 있다. 한 번의 실행은 제목·설명·본문 최대 3개 호출을 포함하며, Backend/공급자 SDK 자체의 재시도와 실제 통화 비용은 이 원장의 정확한 과금 집계가 아니다. 실제 usage 정산·SDK 전체 deadline은 A04/A05 및 운영 측정의 후속 항목이다.

비회원 이미지 5장/일과 회원 이미지 기본 제안 20장/일은 변경하지 않았다. 번역 예산을 이미지 정책으로 대신 계산하지 않는다. `FEATURE_READER_IMAGES`는 모든 환경에서 false를 유지했다.

## API와 기존 소비자의 변경점

- 공개 `/public/posts/:year/:slug/translations/:targetLang` 및 `/cache`: 최초 접수/합류. `observe=true`는 생성하지 않는 캐시 조회다. `jobId`는 해당 글/언어 범위와 함께 검사한다.
- 공개 `/status?jobId=…`: 읽기 전용 작업 상태. queued/deferred/running/succeeded/failed를 반환한다.
- 내부 `/generate`: 인증 필요. 캐시가 즉시 준비되지 않았다면 동기 대기 대신 202+job을 반환한다. `forceRefresh=true`는 검증된 관리자와 안정적인 Idempotency-Key를 요구한다.
- 내부 캐시 DELETE: 기존 관리자 권한 유지. 진행 중/기존 revision을 무효화하고 캐시를 지운다. 다음 GET이 이를 새 유료 생성으로 되살리지 않는다. 재생성은 관리자 명시적 revision이 필요하다.
- Legacy `/translate` 별칭은 유지하되 현재 공개 원문만 번역한다. 클라이언트가 보낸 raw content를 공개 캐시에 직접 넣던 우회는 제거했다.
- Backend `/api/v1/internal/translations/wake`와 Worker `/api/v1/internal/translations/drain`은 기존 내부 key/origin 경계 안에서 동작한다. 공개 사용자가 호출하는 생성 API가 아니다.
- Backend `/ai/generate`가 기존에 누락하던 maxTokens/timeout/model/systemPrompt를 검증하여 전달한다. timeout은 재접속 때 남은 시간이 바뀔 수 있으므로 idempotency payload 해시에서 제외했다.

`translatePost`처럼 즉시 결과만 기대하는 외부/기존 소비자는 202 처리로 전환해야 한다. 블로그 읽기 화면은 새 관찰 경로에 연결했다. 전체 기존 소비자의 운영 호출 통계는 확인하지 못했다.

## 검증 증거

실행 명령: `npm run verify:translation` (Node 22.16.0, 설치된 TypeScript 컴파일러 사용).

| 검사 | 실행 결과 | 실제 대상과 대체 경계 |
|---|---:|---|
| A02 서버 | 66 통과 | 실제 migration/SQL/generator/AI HTTP adapter/상태 handler. D1은 Node SQLite, Hono 등록과 설정 adapter·외부 HTTP는 fixture |
| A02 관찰 | 13 통과 | 실제 관찰 모듈. 타이머와 transport는 fixture, 전체 React 화면 아님 |
| Backend dispatch | 8 통과 | 실제 dispatcher. Worker SSE는 fixture |
| Backend 옵션 | 10 통과 | 소스 AST에서 /generate callback을 그대로 실행. Express·AI·idempotency wrapper는 fixture |
| 기존 R07-1 | 84 통과 | 기존 분리 검사 재실행 |
| 기존 이미지 계약 | 26 통과 | 기존 정책/저장소 검사 재실행 |
| 기존 A01 | 112 통과 | 기존 SEO Node 단위 검사 재실행 |

A02 신규 97개와 기존 222개, 합계 319개가 통과했다. 동일 항목을 재실행한 횟수는 테스트 개수에 다시 더하지 않았다. schema/HTTP/DOM 전체를 시험용 구현으로 바꿔 통합 테스트라고 부르지 않는다. `source-changes.json`, `syntax.json`, TAP 파일, 실제 실행 실패 로그를 `verification/translation-a02/`에 포함했다.

Workers/D1용 기존 repository/job/route 테스트 21개를 새 인터페이스에 맞췄고 shared Zod 계약 검사 6개를 추가했다. 이 suite와 실제 React parser/화면 검사는 의존성 부재로 실행하지 못했다. npm offline 설치는 캐시 누락으로 실패했다. API Worker의 타입 검사, Vitest 실행, frontend 타입 검사, SEO 타입 검사는 의존성 누락으로 실패했으며 전체 빌드 통과로 표시하지 않는다.

## 남은 작업과 한계

**A02 운영 검증이 남아 있다.** 실제 잠금 의존성의 타입/Zod/Hono/D1/React suite, Backend–Worker SSE 연결, 역방향 프록시 타임아웃, cron/동시 요청/프로세스 중단, staging 소유권/비용 검증을 완료해야 한다. Minute cron이 등록됐다는 코드만으로 실제 소비자가 가동한다고 간주하지 않는다.

대기 중에도 언어 선택 버튼을 잠그지 않는다. 사용자가 원문 언어로 돌아가면 관찰만 중단하며 공유 번역 작업을 취소하지 않는다. 실제 키보드·포커스/여러 탭 검증은 별도 미완료다.

**A04는 아직 완료하지 않았다.** 30,000자보다 긴 원문은 잘라 번역하지 않고 생성 전에 CONTENT_TOO_LONG으로 차단한다. 50,000자 fixture는 ‘전체 번역 성공’이 아니라 ‘절단·과금 호출·불완전 캐시 저장 없음’을 검증했다. 블록 번역, 코드/표/링크/각주 보존 검증, 길이비율을 넘어서는 품질 검사, 모델 버전, 원문 저장과 캐시 게시 사이의 완전한 원자성, 자동 캐시 복구 revision은 남아 있다. 현재 SQL은 실행 소유권과 DB에 접수된 더 최신 revision을 함께 검사하지만 외부 원문 원장과의 단일 트랜잭션은 아니다.

원문이 없으므로 게시글 manifest를 재생성하지 않았다. `workers/api-gateway/src/routes/secrets`와 `src/lib/secrets`가 입력본에 빠져 있으며 이를 임의 대체하지 않았다. 실제 원본을 결합해야 전체 API Worker를 빌드할 수 있다. Job/checkpoint 이력의 장기 보관 정책과 실제 provider usage 정산, 완료 뒤 notification 전달의 완전한 원자성은 후속 운영 항목이다.

## 외부 플랫폼 문서

2026-09-10에 열람한 공식 문서. 제품 구현/운영 검증과 구분한다.

- Cloudflare Workers context: https://developers.cloudflare.com/workers/runtime-apis/context/
- Cloudflare D1 batch: https://developers.cloudflare.com/d1/worker-api/d1-database/

실행 환경·복구 절차: [DEPLOYMENT.ko.md](DEPLOYMENT.ko.md). 남은 PR: [tasks.md](../../tasks.md).
