# A02 — 검증·마이그레이션·운영 반영 순서

이 문서는 실행 절차다. 현재 운영 배포나 원격 DB 변경을 완료한 기록이 아니다.

## 먼저 확보할 것

입력본에는 API Worker가 참조하는 `src/routes/secrets`와 `src/lib/secrets` 구현이 빠져 있다. 현행 저장소의 실제 원본을 결합하고 기존 인터페이스/인증을 검증한다. 임시 stub으로 빌드만 통과시키지 않는다. 게시글 Markdown 원문도 빠져 있으므로 콘텐츠를 확보·검증하기 전에는 frontend `prebuild`나 `generate-manifests`를 실행하지 않는다.

workspace lockfile에 맞는 의존성을 설치한다. 이 전달본의 설치 실패는 npm offline 캐시 누락이며, 실제 Worker/React/Zod suite와 전체 타입 검사 통과를 의미하지 않는다. 먼저 아래 비파괴 검사부터 실행한다.

```bash
# blog/에서, Node 22.16 이상과 TypeScript 컴파일러가 있는 환경
npm run verify:translation
npm run verify:anonymous
node scripts/verification/reader-image-contracts.cjs
node scripts/verification/seo-a01-offline.cjs

# 잠금 의존성/누락 원본을 결합한 뒤 실행할 실제 suite
npm --prefix workers/api-gateway run typecheck
npm --prefix workers/api-gateway run test:translation
node --test shared/test/translation-contract.test.js
npm --prefix frontend run type-check
npm --prefix frontend run test:run -- src/test/translationService.test.ts src/pages/public/blog-post/__tests__/BlogPost.characterization.test.tsx src/pages/public/blog-post/BlogPostHeader.test.tsx
npm --prefix workers/seo-gateway run verify
```

위 명령은 콘텐츠 generator를 직접 실행하지 않는다. 실제 전체 bundle 검사는 완전한 공개 원문과 asset을 확보한 환경에서 별도로 진행한다. Backend의 기존 인증·AI generate·translation proxy 관련 suite도 함께 실행한다.

## DB 변경

새 파일: `workers/migrations/0041_translation_execution.sql`. 기존 0039 reader image와 0040 anonymous revocation을 변경하거나 재번호화하지 않았다. 실제 운영 마이그레이션 목록과 먼저 대조한다.

1. 기존 translation 작업 실행기와 오래된 artifact flush/내부 직접 생성 경로를 중지한다. 기존 Worker와 새 Worker가 같은 DB에서 번역 작업을 동시에 쓰지 않도록 한다.
2. D1의 작업·캐시·outbox 전체를 백업하고 보관 원칙을 확인한다. 그다음 0041을 staging부터 적용한다.
3. 마이그레이션은 기존 job을 복사하며, running은 결과 불명확 상태로 남긴다. 이것이 실패한 provider 요청임을 증명하지는 않는다. 기존 번역 캐시 본문은 보존된다.
4. 원문 버전 필드와 새 인덱스, 예약 장부의 존재를 확인한다. 기존 job 수가 감소하지 않았는지, 기존 cache 내용이 유지되는지 확인한다.

마이그레이션은 `translation_jobs`를 재구성하고 cache에 컬럼을 추가한다. **기존 바이너리와 혼합 쓰기를 허용하는 단순 무중단 변경이 아니다.** 전체 D1 환경에서의 migration/rollback 검증을 끝내기 전 운영에 적용하지 않는다.

## 서비스 연결

Backend는 기존 `WORKER_API_URL`과 `BACKEND_KEY`를 사용해 `POST /api/v1/internal/translations/drain`으로 연결한다. Worker는 기존 `BACKEND_ORIGIN`과 key/origin 서명 설정을 사용해 `POST /api/v1/internal/translations/wake`로 짧은 신호를 보낸다. 임의 클라이언트 URL이나 key를 이 설정으로 받아서는 안 된다.

배포 순서는 Backend wake/옵션 전달 코드 → 0041과 호환되는 Worker(실행 flag 꺼짐) → 새 frontend job parser/관찰 UI → staging 검증 → 번역 실행 flag 활성화다. DB 변경은 그전에 구 실행기를 정지한 상태에서 완료되어야 한다. 이미 운영 중인 프런트의 202/실패 호환도 함께 검사한다.

내부 drain은 open/15초 heartbeat/done을 보내고 연결을 유지한다. proxy buffering, SSE MIME, Backend 300초 관찰, Worker 240초 생성 deadline과 330초 lease, 실제 provider timeout/SDK retry를 검증한다. 연결이 종료되면 무조건 재생성하는 재시도 설정은 추가하지 않는다.

기본·production·staging에 매분 translation cron을 명시했다. 기존 매일 유지보수 및 매시 30분 이미지 정리 cron도 유지했다. 매분 분기에서는 번역 drain만 실행한다. 실제 trigger 등록, staging의 독립 DB/KV/원본 origin/key, production과의 분리를 확인한다. 기존 staging에는 독립 DB/KV binding 설정이 충분하지 않으므로 운영 DB를 대신 연결하지 않는다.

## 활성화 조건

`TRANSLATION_EXECUTION_ENABLED`와 `TRANSLATION_WARM_ENABLED`는 모두 false로 전달한다. 준비가 된 환경에서만 전자를 true로 바꾸며 warm은 별도로 승인한다. 동시성/일별/글별 예약 기본값을 실제 모델·사업 비용에 맞춰 설정한다. 예약 단위는 실청구 토큰/통화 비용이 아니므로 provider usage와 비교해야 한다.

기존 `FEATURE_READER_IMAGES`는 false 그대로다. 번역 배포가 이미지 기능 활성화를 의미하지 않는다. 일반 회원가입, guest 이관 및 실제 R07-1 운영 검증 역시 자동 완료되지 않는다.

## staging 확인 항목

| 확인 | 받아들일 조건 |
|---|---|
| 동일 공개·내부·warm 요청 100회 | job/outbox 하나, 모델 단계 중복 없음, interactive priority 반영 |
| Backend 프로세스 종료/신호 유실 | cron이 같은 job을 찾음. 제출 전 중단은 재개, 제출 후 결과 없음은 RESULT_UNKNOWN |
| 긴 연결/재연결 | heartbeat가 지연 없이 통과하며 관찰 종료가 새 모델 호출로 이어지지 않음 |
| 한도/시차 | 동시 claim 상한, 한국 시간 00:00 기준 예약 초기화, 작업별 시도 상한 |
| 원문 변경·비공개 전환 | 오래된 cache 쓰기/공개 status 노출 차단 |
| 관리자 강제 재생성 | 기존 관리자 인증 유지, 일반 회원 거절, 같은 Idempotency-Key는 같은 revision |
| 브라우저 | 원문 유지, 상태 확인만 재개, 탭 복원/언어 변경/늦은 응답/포커스 검증 |
| 이전 cache | 정상 기존 cache 본문 보존. 이전 버전을 현재 검증 완료로 잘못 표시하지 않음 |
| 비용 | title/description/content maxTokens가 실제 backend/provider까지 전달, SDK 재시도 비용 측정 |

A02의 97개 분리 테스트만으로 이 표 전체를 통과했다고 판단하지 않는다. A01 runtime/staging과 R07-1 인증·다중 탭 검증도 기존 작업 목록대로 남는다.

## 중지·되돌리기

우선 새 실행 flag를 끄고 접수를 deferred로 표시한다. 검증된 기존 cache는 계속 제공하고 D1 job/checkpoint/outbox를 보존한다. 이미 실행 중인 provider 요청이 flag 변경으로 즉시 취소되는 것은 아니다. 신규 claim만 중단되므로 진행 중 작업과 비용을 따로 확인한다.

0041 적용 후 구 translation 바이너리를 무조건 배포하는 rollback은 안전하지 않다. 캐시 읽기와 작업 기록을 유지하는 호환 코드로 중지하거나, 승인된 백업 복원 절차를 사용한다. 백업 시점 이후 데이터의 유실 가능성을 검토하지 않은 복원은 하지 않는다. R07-1의 ID-only 재발급 취약 경로는 다시 열지 않는다.

CONTENT_TOO_LONG/RESULT_UNKNOWN/CACHE_INVALIDATED는 반복 GET으로 고치는 상태가 아니다. 긴 글은 A04 블록 번역을 구현하고, 결과 불명확은 실제 공급자/Backend 기록을 확인한다. 재생성을 승인한 경우에만 관리자가 새 revision 키를 제출한다.
