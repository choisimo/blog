# Reader experience: 배포 및 검증

운영 배포 절차와 **2026-09-12 운영 검증 기록**을 정리한다. 상태 저장소의 백업·복구 상세는 [Worker state 운영 문서](../ops/worker-state-store.md)를 기준으로 한다.

## 1. 현재 운영 구성

Frontend → Cloudflare API Gateway → Kubernetes Blog API → AI-server/LiteLLM 경로를 사용한다. 이미지 생성은 `POST /api/v1/images/generate`에서 한도를 예약한 뒤 내부 `/api/v1/images/render-private`를 호출한다. 내부 renderer 경로는 공용 edge에서 차단한다. Provider 키는 브라우저에 전달하지 않는다.

운영 Gateway의 `STATE_STORE_BACKEND="origin"`은 `env.DB`를 서명된 HTTP adapter로 교체한다. 요청 및 cron의 상태 접근은 backend의 `/internal/state-db/query`를 거치며, backend key와 검증된 gateway 서명이 모두 필요하다. 운영 Wrangler 설정의 `d1_databases`는 비어 있다. **Origin 장애 시 D1 fallback이나 timeout write 자동 재전송은 없다.**

- API는 `WORKER_STATE_SQLITE_PATH=/app/.data/worker-state.db`를 사용한다. 기존 `/app/.data/blog.db`와 별개이며 Worker 이력은 `d1_migrations`에 남는다.
- API Deployment는 1 replica, `Recreate` 전략이며 5Gi `api-sqlite` PVC를 `/app/.data`에 연결한다. AI-worker 2 replicas는 이 PVC를 직접 mount하지 않는다.
- API readiness에는 `worker_state` 검사가 포함된다. 단일 API/PVC에 의존하므로 API 재시작·장애와 migration의 쓰기 잠금은 Worker 상태 기능의 가용성에 영향을 준다.

| 설정 | 현재 운영 소스 | 적용 범위 |
| --- | --- | --- |
| Gateway `FEATURE_READER_IMAGES` | `"true"` | `workers/api-gateway/wrangler.toml`의 production |
| Backend `FEATURE_READER_IMAGES` | `"true"` | `k3s/configmap.yaml` |
| `READER_IMAGES_R2` | `blog-reader-images-prod` | 공개 자산 `R2 = blog`와 분리된 전용 비공개 bucket |
| `TRANSLATION_EXECUTION_ENABLED` | `"true"` | 사용자 요청 번역 실행 |
| `TRANSLATION_WARM_ENABLED` | `"false"` | 백그라운드 번역 warming |

기본 개발 설정과 staging의 이미지 flag는 `false`이며 전용 R2 바인딩 예시도 주석 상태다. 환경별 설정을 확인하고, 기능의 실행 결과는 아래 운영 검증 기록으로 판단한다.

## 2. 상태 마이그레이션과 배포 절차

### 마이그레이션 기준

2026-09-12 import 기록에는 **migration 이력 43건**이 있다. 저장소 SQL 파일 41개(`0041_translation_execution.sql`까지)와 보존된 과거 이력 `0038_edge_rate_limits.sql`, `0039_auth_ephemeral_records.sql` 2건이다. 이는 import 시점의 기록이며 이후 배포에서 고정된 예상 개수로 검사하지 않는다. `0039_reader_image_jobs.sql`은 이미지 작업·사용량 기록 및 계정 설정 테이블을 포함한다.

**현재 운영 origin 모드에서는 D1 migration apply 명령을 실행하지 않는다.** 기존 backend `blog.db`용 migration loader도 Worker 상태 DB에 사용하지 않는다. `.github/workflows/deploy-workers.yml`은 origin 모드에서 backend schema를 검증하고 D1 apply/검증 단계를 건너뛴다. 이 검증 단계가 SQLite migration을 대신 적용하지는 않는다.

API 이미지에는 `/app/backend/src/scripts/migrate-worker-state.js`와 `/app/workers/migrations`가 함께 포함된다. CLI는 이미지에 포함된 SQL을 기본으로 사용하며 별도로 동기화된 `/workers` mount에 의존하지 않는다.

먼저 읽기 전용으로 이력과 pending 파일을 확인한다.

```sh
ssh blog 'kubectl -n blog exec deployment/api -- node /app/backend/src/scripts/migrate-worker-state.js --check'
```

`--check`는 변경을 적용하지 않는다. 종료 코드만 보지 말고 JSON의 `pending`, `ledgerCount`, `additionalLedgerEntries`를 확인한다. CLI는 기존의 비어 있지 않은 imported DB와 유효한 `d1_migrations`를 요구하며 새 DB를 초기화하지 않는다.

### 배포 순서

1. 대상 backend 이미지와 migration 파일, 환경별 R2/flag/provider 설정을 확인한다. Backend 이미지는 `.github/workflows/deploy-blog-workflow.yml`에서 build/push한다. 실제 실행 이미지와 readiness를 별도로 확인한다.
2. Pending migration이 있으면 maintenance window에 상태 저장소를 사용하는 요청·백그라운드 writer를 중단하고, 의도한 API 이미지가 실행 중인지 확인한 뒤 아래 CLI를 실행한다. Pending이 없으면 적용 작업을 생략한다.
3. CLI 결과의 적용 파일·백업 경로를 기록하고 `--check`의 pending 없음 및 API `worker_state` readiness를 확인한 뒤 트래픽을 재개한다.
4. `.github/workflows/deploy-workers.yml`의 backend schema 검증과 private R2 확인을 통과한 production Gateway를 배포한다. Backend와 Worker workflow가 함께 시작될 수 있으므로 실제 선행 조건 충족 여부로 판단한다.
5. `.github/workflows/deploy.yml`의 Frontend 검증/build/Pages 배포 결과와 실제 제공 버전을 확인한다. 배포 후 아래 기능별 검증을 수행하고 이미지·번역 완료 여부를 각각 기록한다.

```sh
# Writer 중단 및 대상 API 이미지 확인 후에만 실행
ssh blog 'kubectl -n blog exec deployment/api -- node /app/backend/src/scripts/migrate-worker-state.js'
```

CLI는 `BEGIN IMMEDIATE` 잠금 후 이력을 다시 읽고, committed WAL까지 포함한 private SQLite 백업을 만든다. Pending SQL과 이력 추가를 한 transaction에서 적용하고 integrity/foreign-key 검증 후 commit한다. 실패하면 batch 전체를 rollback하고 백업을 보존한다. Pending이 없으면 백업이나 쓰기를 수행하지 않는다. 적용된 SQL 파일은 수정하지 않고 새 파일을 추가한다.

DB 옆 백업만으로는 노드/PVC 유실에 대비할 수 없다. 외부 암호화 백업과 복원 절차는 [운영 문서](../ops/worker-state-store.md)의 제약을 따른다. 새 쓰기가 발생한 뒤 오래된 SQLite snapshot 또는 D1로 되돌리면 해당 쓰기를 잃는다. 호환되는 이전 코드나 전진 migration을 우선하며, DB 교체는 모든 연결을 중단한 상태에서 수행한다.

## 3. 이미지 저장소와 연결 설정

운영 배포의 `scripts/ensure-reader-image-bucket.mjs`는 전용 bucket을 확인·필요 시 생성하고, r2.dev 접근을 끄며 활성 public custom domain이 있으면 실패한다. 공개 `blog` bucket을 재사용하지 않는다. 이 스크립트는 lifecycle을 설정하지 않으므로 `private/reader-images/` prefix의 7일 expiration lifecycle은 별도 운영 설정으로 확인한다.

- 이미지는 소유자 인증 후 `/api/v1/images/generated/:id`로만 제공하고 `private, no-store`를 사용한다. 생성 후 7일을 넘긴 객체는 앱에서 읽기를 거부한다.
- 매시 30분 cleanup은 한 번에 최대 200행을 처리하며 R2 저장 후 상태 DB 확정에 실패한 객체도 회수한다. 삭제 실패 시 pointer를 남긴다.
- 객체 삭제가 확인된 작업만 생성 시각 기준 30일 이후 tombstone 정리 대상이 된다. Cleanup 및 lifecycle 실행 시점 때문에 정확히 7일째 물리 삭제를 보장하지 않는다.

Gateway의 `BACKEND_ORIGIN`, `BACKEND_KEY`, `JWT_SECRET`, `GATEWAY_SIGNING_SECRET` 또는 호환 `BACKEND_GATEWAY_SIGNING_SECRET`을 기존 비밀 관리 경로로 관리한다. Production origin은 HTTPS를 요구한다. 값이나 서명된 요청을 문서·로그에 복사하지 않는다.

Backend의 `AI_IMAGE_PROXY_BASE_URL`, `AI_IMAGE_PROXY_API_KEY`, `AI_IMAGE_MODEL`은 기존 AI-server 설정에 맞춘다. URL은 `/images/generations` endpoint를 구성할 수 있어야 한다. Provider는 base64 raster를 반환해야 하며 외부 URL-only 결과는 허용하지 않는다. Backend는 PNG/JPEG/WebP를 검증해 PNG로 변환하고 Gateway는 PNG signature와 최대 8MiB 크기를 확인한 뒤 R2에 저장한다. 지원 모델·크기·latency와 실제 PNG 다운로드는 라이브에서 별도 검증한다.

긴급 중단 시 Gateway와 backend의 `FEATURE_READER_IMAGES=false`로 새 생성을 막는다. Gateway의 보관 기간 내 기존 이미지 조회는 이 flag와 독립적이며 상태 DB·R2·인증이 정상이어야 한다.

## 4. 이미지 한도와 불확실한 결과 처리

| 정책 | 현재 값과 의미 |
| --- | --- |
| 비회원 | `DEFAULT_FREE_IMAGE_LIMIT = GUEST_IMAGE_LIMIT = 20`, 하루 20장 |
| 회원 | `MEMBER_IMAGE_DAILY_LIMIT=20`, 기본값 20이며 설정 가능(1–500) |
| 전체 서비스 | `IMAGE_GLOBAL_DAILY_LIMIT=500`, 설정 가능(1–10000) |
| 리셋 | `Asia/Seoul` 매일 00:00(KST), 응답의 `resetAt` 참조 |
| 요청당 | 1장 |
| 짧은 시간 제한 | 소유자 또는 익명 네트워크 기준 60초 내 5회 |
| 당일 사용량에 포함 | `reserved`, `complete`, `unknown` |

익명 JWT가 있다는 이유로 회원 한도를 적용하지 않는다. 회원 판정은 유효한 `sub`, refresh가 아닌 token, `user/member/admin` role 및 `emailVerified=true`를 요구한다. 비회원은 소유자와 Cloudflare의 `CF-Connecting-IP` 기반 일별 HMAC 네트워크 한도를 함께 적용하므로 익명 identity를 바꿔도 동일 네트워크의 한도가 초기화되지 않는다. 0·음수·비정수·범위 밖 설정은 무제한이 아니라 회원 20/전체 500 기본값으로 돌아간다.

`Idempotency-Key`로 작업을 식별한다. 같은 키·같은 입력은 기존 상태를 반환하고 provider를 다시 호출하지 않는다. 같은 키의 입력 변경은 `IDEMPOTENCY_CONFLICT`다.

- 명시적으로 생성되지 않았음을 확인한 거절은 `failed`로 저장하고 당일 사용량에서 제외한다. 짧은 시간 제한에는 실패한 시도도 포함된다.
- Provider 5xx/timeout, 잘못된 결과, 저장·확정 실패처럼 생성·과금 여부가 불확실하면 `unknown` / `IMAGE_OUTCOME_UNKNOWN`으로 취급한다. Backend는 불확실한 renderer 결과에 502, Gateway는 불확실한 작업에 409를 반환한다. 실패 응답만으로 미생성·미과금을 단정하지 않는다.
- `unknown`은 같은 날 한도에서 제외하지 않으며 **자동 재생성·자동 환불하지 않는다**. 상태 저장까지 실패하면 `reserved`가 남을 수 있고 이 경우에도 자동 재실행하지 않는다.
- 프런트는 불확실한 작업을 3초 간격으로 최대 약 6분간 **상태 조회**할 수 있다. 수동 상태 확인도 `GET /api/v1/images/generations/:key`를 사용한다. 이는 생성 POST 재시도가 아니다. 명시적으로 한도가 반환된 provider unavailable/rate-limit 실패의 사용자 재시도만 새 키를 사용한다.

## 5. 2026-09-12 운영 검증 기록

PASS는 각 행의 관측 범위에 한정한다. 후속 배포에서는 버전·검증일·결과를 함께 갱신한다.

| 대상 | 운영 관측 | 판정 범위 |
| --- | --- | --- |
| Kubernetes API rollout | `601c3e8`, API 1 ready / AI-worker 2 ready | PASS: 해당 rollout의 준비 상태 |
| Argo CD | `Synced`, `Healthy` | PASS: 동기화·건강 상태 |
| Production Worker | main PR #191 배포, version `01e8016f` | PASS: 해당 배포 확인 |
| 서명된 DB health | HTTP 200, `tableCount=71`, `ledgerCount=43` | PASS: 상태 저장소 health와 이력 개수 |
| 서명된 DB 읽기 | 3회 모두 HTTP 200 | PASS: 검사한 읽기 요청 |
| 서명 없는 DB 요청 | HTTP 401 | PASS: 검사한 비인증 요청 차단 |
| 익명 세션 + 이미지 policy | HTTP 200, 기본 한도 20 | PASS: 인증·정책 조회 |
| 실제 Summary | 기록값 `1109` | PASS: 해당 응답 |
| 실제 Catalyst | 기록값 `238` | PASS: 해당 응답 |
| Settings / context / proposal | 설정·context·proposal 동작 확인 | PASS: 검사한 동작 |
| Chat 수정 PR #192 | `d01743fd`로 merge, visual 포함 전체 CI PASS | PASS: 해당 변경의 CI |
| Frontend Pages | run `34642028134` SUCCESS | PASS: 해당 Pages 배포 |
| 운영 Chat | 실제 응답, 메모 첨부 및 이미지 버튼 유지 | PASS: 응답·첨부·버튼 보존 |
| 새 번역 | `queued` 확인 | **완료 미확인**; 실제 번역 결과까지 검증 필요 |
| 새 UI 이미지 생성 | 1회 시도에서 HTTP 409 `UNKNOWN` 재발; 이전 시도는 provider 502 | **PNG 생성·표시·다운로드 미확인** |

Chat 검증 화면: `/tmp/blog-reader-ai-20260912/live-chat-session-fixed.png`.

남은 검증은 새 번역의 최종 성공 상태와 결과 표시, 이미지의 불확실한 결과 원인 확인 및 실제 PNG 저장·소유자 조회·다운로드·동일 키 중복 방지다. 이미지 버튼 보존은 이미지 생성 성공과 별개다. `UNKNOWN` 작업은 상태만 조회하고 자동 재생성하지 않는다.

후속 운영 검증에서는 회원/익명 재접속, 다른 소유자 접근 차단, CORS, 만료 조회, private R2 공개 접근 차단 및 billing/한도 일치도 검사한 범위와 함께 기록한다.

## 6. 반복 가능한 검증과 소스 근거

저장소 root에서 패키지 설치 후 변경 범위에 해당하는 개발/CI 검사를 수행한다.

```sh
npm --prefix backend test
npm --prefix workers/api-gateway run typecheck
npm --prefix workers/api-gateway test
npm --prefix frontend run type-check
npm --prefix frontend run lint
npm --prefix frontend run test:deploy
npm --prefix frontend run build

TYPESCRIPT_PATH="$PWD/frontend/node_modules/typescript" \
  node --test scripts/verification/reader-image-contracts.cjs

node scripts/check-contract-drift.mjs
node scripts/check-route-governance.mjs
```

Frontend build는 manifest 등 생성물을 갱신할 수 있다. `reader-image-contracts.cjs`는 한도·KST 경계·멱등성·retention 검증을 보완하며 전체 build/typecheck나 실제 provider 검증을 대체하지 않는다. `reader-source-syntax.cjs`는 변경 파일의 구문만 검사한다. `reader_workspace_browser.py`는 네트워크를 차단한 `set_content`와 메모리 Storage 어댑터를 쓰므로 실제 로그인·API·브라우저 재시작 후 저장 지속성의 E2E 증거가 아니다. 계약 snapshot 비교 역시 저장된 snapshot과의 일치만 증명한다.

운영 절차와 설정의 소스 근거는 다음과 같다.

| 검증한 사항 | 소스 경로 |
| --- | --- |
| Origin 모드·서명·fallback 없음 | [Wrangler 설정](../../workers/api-gateway/wrangler.toml), [backend adapter](../../workers/api-gateway/src/lib/backend-state-db.ts), [내부 route](../../backend/src/routes/workerState.js) |
| PVC·replica·flag·readiness | [Kubernetes API](../../k3s/api.yaml), [ConfigMap](../../k3s/configmap.yaml), [backend 진입점](../../backend/src/index.js), [SQLite service](../../backend/src/services/worker-state-store.service.js) |
| Import 이력·migration·복구 | [운영 문서](../ops/worker-state-store.md), [migration CLI](../../backend/src/scripts/migrate-worker-state.js), [CLI tests](../../backend/test/migrate-worker-state.test.js), [이미지 migration](../../workers/migrations/0039_reader_image_jobs.sql), [Dockerfile](../../backend/Dockerfile) |
| 배포 gate·origin schema·private R2 | [Worker workflow](../../.github/workflows/deploy-workers.yml), [schema 검증](../../scripts/verify-backend-state.mjs), [bucket 검증](../../scripts/ensure-reader-image-bucket.mjs), [backend workflow](../../.github/workflows/deploy-blog-workflow.yml), [Frontend workflow](../../.github/workflows/deploy.yml) |
| 한도·회원 판정·KST·멱등성 | [policy](../../workers/api-gateway/src/lib/reader-image-policy.ts), [repository](../../workers/api-gateway/src/lib/reader-image-repository.ts), [image routes](../../workers/api-gateway/src/routes/reader-images.ts), [image tests](../../workers/api-gateway/test/reader-images.test.ts) |
| PNG·provider 오류 처리 | [renderer](../../backend/src/routes/readerImageRender.js), [provider service](../../backend/src/services/ai-image/litellm-image-generation.service.js), [renderer tests](../../backend/test/reader-image-render.test.js) |
| Retention·cron | [cleanup](../../workers/api-gateway/src/lib/reader-image-retention.ts), [Worker 진입점](../../workers/api-gateway/src/index.ts) |
| 재생성 없는 상태 조회·이미지 읽기 | [GeneratedImageCard](../../frontend/src/components/features/ai/GeneratedImageCard.tsx), [readerImages client](../../frontend/src/services/personal/readerImages.ts) |
| 번역 접수와 완료 구분 | [translation route](../../workers/api-gateway/src/routes/translate.ts) |
| 검증 명령·검사 한계 | [Frontend scripts](../../frontend/package.json), [Gateway scripts](../../workers/api-gateway/package.json), [backend scripts](../../backend/package.json), [독립 계약 검사](../../scripts/verification/reader-image-contracts.cjs), [구문 검사](../../scripts/verification/reader-source-syntax.cjs), [브라우저 fixture](../../scripts/verification/reader_workspace_browser.py) |
