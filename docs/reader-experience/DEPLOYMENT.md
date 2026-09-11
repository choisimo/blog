# Reader experience: 배포 순서

이 문서는 2026-09-10 첨부 스냅샷에 적용한 변경의 배포 안내다. 실제 배포, 비밀키 설정, 외부 이미지 생성은 이 작업에서 실행하지 않았다.

## 1. 먼저 확인할 환경

Frontend → Cloudflare API Gateway → Blog Backend → 기존 AI-server/LiteLLM 이미지 생성 경로를 사용한다. 브라우저에는 provider 키를 전달하지 않는다. 새 이미지 endpoint는 `/api/v1/images/generate`다. 내부 `/api/v1/images/render-private`는 공용 edge에서 차단한다.

Backend의 기존 `AI_IMAGE_PROXY_BASE_URL`, `AI_IMAGE_PROXY_API_KEY`, `AI_IMAGE_MODEL`을 실제 AI-server 설정으로 맞춘다. URL은 `/images/generations`를 붙일 수 있는 base이며 일반적으로 `/v1`까지 포함한다. 기존 값이 이미 올바르면 변경하지 않는다. 반환 형식은 PNG/JPEG/WebP의 base64여야 하며 외부 URL-only 응답은 허용하지 않는다. 모델명과 지원 크기는 해당 AI-server에서 실제 검증해야 한다.

## 2. D1 migration

현재 migration 이력을 먼저 확인한다. 이전 migration을 임의로 건너뛰지 않는다.

```bash
cd workers/api-gateway
npx wrangler d1 migrations list DB --env production --remote
npx wrangler d1 migrations apply DB --env production --remote
```

실제 운영 적용 전에 staging에서 동일 절차를 수행한다. `0039_reader_image_jobs.sql`은 이미지 작업·사용량 기록과 계정 설정 테이블 및 인덱스를 추가한다. 기존 메모/버전 테이블을 삭제하거나 재작성하지 않는다. 운영 데이터 백업과 계정 확인 후 실행한다.

## 3. 전용 비공개 R2

`wrangler.toml` 하단의 예시 중 대상 환경에 맞는 `READER_IMAGES_R2` 바인딩을 활성화한다. 예시 bucket 이름은 생성된 실제 bucket 이름으로 변경한다. 기존 `R2 = blog` 공개 자산 bucket을 재사용하지 않는다.

- R2 bucket 생성 후 r2.dev 공개 접근 및 공개 custom domain을 끈다.
- `private/reader-images/` prefix에 7일 expiration lifecycle을 둔다.
- 앱은 생성 후 7일이 지난 이미지 읽기를 즉시 거부한다. 실제 object 삭제는 매시 30분 cleanup 및 R2 lifecycle의 실행 시점에 따라 뒤따른다. 정확히 7일째 물리 삭제된다고 보장하지 않는다.
- cleanup은 한 번에 200행을 처리한다. 완료 객체뿐 아니라 R2 저장 후 D1 확정에 실패한 객체도 회수한다. 삭제 실패 시 pointer를 남기며, 삭제된 작업 tombstone은 30일 후 정리한다.

R2 lifecycle 참고: https://developers.cloudflare.com/r2/buckets/object-lifecycles/

## 4. 기존 gateway 인증 설정 유지

`BACKEND_ORIGIN`, `BACKEND_KEY`, `JWT_SECRET`, `GATEWAY_SIGNING_SECRET` 또는 기존 호환 signing secret이 필요하다. production/staging에서는 gateway 서명 설정이 없으면 새 생성을 받지 않는다. Backend key와 signing secret은 기존 비밀 관리 경로로 관리하며 프런트 환경변수에 넣지 않는다.

## 5. 순서대로 활성화

1. migration + private R2 + credentials 확인.
2. Backend 배포 후 `FEATURE_READER_IMAGES=true` 적용.
3. Gateway 배포 후 대상 환경의 `FEATURE_READER_IMAGES="true"` 적용.
4. Frontend 배포. `frontend/index.html`의 메모장 asset query도 새 버전으로 변경돼 있다.
5. staging에서 실제 생성 1장, 객체 조회/다운로드, 동일 request key 재요청을 확인한 후 운영에 같은 설정 적용.

현재 소스의 feature flag는 `false`다. 연결되지 않은 환경에서 비용이 발생하거나 공개 bucket에 저장되지 않도록 한 것이다. 비활성화 중에도 기존 글 답변과 메모장은 사용할 수 있다.

정책값:

```text
비회원: 코드에서 하루 5장 고정
회원: MEMBER_IMAGE_DAILY_LIMIT=20   # 초기 운영 제안값, 변경 가능
전체 서비스: IMAGE_GLOBAL_DAILY_LIMIT=500 # 비용 차단용 제안값
리셋: Asia/Seoul 00:00
요청당: 1장 고정
짧은 시간 제한: 소유자 또는 익명 네트워크별 60초 내 5회
```

환경값이 0/음수/범위 밖이면 무제한이 아니라 안전한 기본값으로 돌아간다. 비활성화는 `FEATURE_READER_IMAGES=false`로 한다. 새 생성만 중단하고 보관 기간 내 기존 객체 조회는 유지한다.

## 6. 운영 승인 전에 남은 검증

실제 인증 JWT의 member/admin + emailVerified, 익명 재접속, Cloudflare가 주입하는 CF-Connecting-IP, Hono 라우팅과 CORS, 실제 모델의 이미지 크기/latency, PNG 변환, private R2 접근 차단, 만료 이미지 조회 차단, billing과 quota 일치 여부를 staging에서 확인한다.

provider timeout처럼 결과가 불명확한 요청은 `unknown`으로 보관하고 같은 날 한도에서 제외하지 않는다. 연결 복구 버튼은 동일 작업 상태만 조회한다. 자동 재생성/자동 환불은 하지 않는다. provider 상태 API에 연결한 결과 복구와 운영자 정산 UI는 후속 작업이다. `reserved`에서 worker가 종료된 경우에도 자동 재실행하지 않는다.

원래 폴더의 `docs/generated` 계약 스냅샷이 누락돼 있어, 현재 계약을 기준으로 두 스냅샷을 생성했다. 비교 통과는 기존 기준 대비 무변경을 의미하지 않으며 현재 계약과 저장된 스냅샷의 일치 확인이다.

## 7. 검증 명령

패키지 설치가 가능한 개발/CI 환경에서 Frontend와 Gateway의 원래 build/typecheck/test를 먼저 실행한다. 아래 독립 테스트는 이를 대체하지 않는다.

```bash
# 저장소 root에서. Frontend dependencies 설치 후:
TYPESCRIPT_PATH="$PWD/frontend/node_modules/typescript" \
  node --test scripts/verification/reader-image-contracts.cjs

TYPESCRIPT_PATH="$PWD/frontend/node_modules/typescript" \
POSTCSS_PATH="$PWD/frontend/node_modules/postcss" \
  node scripts/verification/reader-source-syntax.cjs

node scripts/check-contract-drift.mjs
node scripts/check-route-governance.mjs

# Python Playwright + Chromium 설치 환경. 실제 memo JS/CSS, API 호출 없음.
python scripts/verification/reader_workspace_browser.py
```

브라우저 검증은 외부 URL 접근이 막힌 환경에서 `set_content`로 실제 컴포넌트와 CSS를 넣었다. Storage-compatible 메모리 어댑터를 쓰므로 실제 localStorage의 재시작 후 지속성, 실제 브라우저 quota, 계정 로그인 E2E를 검증한 결과는 아니다. 저장 실패 대응은 어댑터에서 오류를 주입해 검증했다.
