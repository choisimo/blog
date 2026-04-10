# 블로그 플랫폼 아키텍처 심층 분석 요청 프롬프트

> **사용법**: 아래 프롬프트를 통째로 복사하여 AI에게 전달하세요.
> 프로젝트 루트(`blog/`)를 컨텍스트로 첨부한 상태에서 실행하면 됩니다.
> 각 섹션은 독립적으로 사용할 수도 있고, 전체를 한 번에 요청할 수도 있습니다.

---

## 0. 공통 지시사항

```text
이 프로젝트는 모노레포 구조의 풀스택 블로그 플랫폼입니다.

구성:
- frontend/        → React 18 + TypeScript + Vite SPA (GitHub Pages 배포)
- workers/         → Cloudflare Workers 4개 (api-gateway, r2-gateway, terminal-gateway, seo-gateway)
- backend/         → Node.js (Express, ESM) API 서버 + terminal-server (TypeScript, WebSocket)
- shared/          → @blog/shared — Zod 기반 계약(contract) 모듈
- k3s/             → Kubernetes 매니페스트 (ArgoCD GitOps)
- scripts/         → 거버넌스/감사 스크립트
- .github/workflows/ → CI/CD 파이프라인 3개

분석 시 다음 규칙을 따르세요:
1. 모든 판단에는 근거가 되는 파일 경로와 라인 번호를 명시하세요.
2. 문제점 지적 시 반드시 구체적 개선안(코드 스니펫 포함)을 함께 제시하세요.
3. 심각도를 [Critical / High / Medium / Low / Info] 5단계로 분류하세요.
4. 한국어로 응답하되, 코드와 기술 용어는 원문 그대로 유지하세요.
```

---

## 1. 요청 경로(Request Flow) 엔드투엔드 추적 분석

```text
다음 5가지 시나리오 각각에 대해, 요청이 브라우저에서 출발하여 최종 응답이 돌아오기까지의
전체 경로를 추적하세요. 각 단계마다 관여하는 파일, 함수명, 미들웨어, 헤더 변환을 명시하세요.

시나리오 목록:
  A. 비로그인 사용자가 블로그 글 목록을 조회할 때 (/blog → /api/v1/posts)
  B. 로그인 사용자가 AI 채팅 메시지를 보낼 때 (SSE 스트리밍 응답 포함)
  C. 관리자가 터미널을 열 때 (WebSocket 연결 → Docker 샌드박스 생성까지)
  D. 검색엔진 크롤러(Googlebot)가 블로그 포스트 URL에 접근할 때 (SEO 게이트웨이 경유)
  E. 일일 크론잡이 실행될 때 (analytics refresh → editor_picks 선정 → 오래된 데이터 퍼지)

각 시나리오에 대해 다음을 포함하세요:
  1. Mermaid 시퀀스 다이어그램
  2. 각 홉(hop)에서의 인증/인가 검증 내용
  3. 데이터가 거치는 저장소(D1, PostgreSQL, Redis, KV, R2, ChromaDB) 표기
  4. 에러 발생 시 폴백 경로 및 에러 전파 방식
  5. 성능 병목 가능 지점 식별
```

---

## 2. 인증 · 인가 · 세션 관리 체계 분석

```text
이 플랫폼의 인증/인가 체계를 계층별로 분석하세요.

2-1. 인증 계층 맵핑
  - Cloudflare Access (IAP) → Worker JWT 검증 → Backend requireBackendKey →
    requireAdmin / requireUserAuth / requireFeature 까지의 전체 인증 체인을 정리하세요.
  - 각 계층에서 검증하는 항목(서명, 만료, 클레임, IP 등)을 구체적으로 나열하세요.
  - 계층 간 신뢰 전파 방식(어떤 헤더가 어떤 값을 전달하는지)을 명시하세요.

2-2. 토큰 생명주기 분석
  - Access Token, Refresh Token, Anonymous Token 각각의:
    - 발행 주체 (어떤 파일, 어떤 함수)
    - 클레임 구조 (sub, role, type, emailVerified 등)
    - 만료 시간 및 갱신 메커니즘
    - 저장 위치 (클라이언트 Zustand, httpOnly cookie, KV 등)
  - Refresh Token Rotation 구현의 정확성 검증 (재사용 탐지 여부)

2-3. 터미널 입장 토큰 (Admission Token) 보안 분석
  - terminal-gateway에서 발행하는 HMAC 토큰의 전체 구조와 검증 흐름
  - 시간 기반 공격(replay, clock skew) 방어 충분성
  - IP 바인딩 + User-Agent 해시 바인딩의 실효성 분석
  - `nbf` (not before) - 5초 여유가 적절한지 평가

2-4. TOTP 2FA 구현 분석
  - QR 코드 생성 → 챌린지 저장(KV) → 검증 → emailVerified 클레임 반영 흐름
  - TOTP 시간 윈도우, 재사용 방지 구현 여부

2-5. OAuth 흐름 분석 (GitHub, Google)
  - PKCE 사용 여부
  - state 파라미터 CSRF 방어 구현 검증
  - 콜백 후 토큰 발행까지의 전체 경로

2-6. 취약점 점검
  - IDOR (Insecure Direct Object Reference) 방어: requireUserOwnership() 적용 범위 확인
  - 권한 상승 경로 존재 여부 (일반 사용자 → 관리자)
  - 세션 고정 공격(Session Fixation) 방어 여부
  - JWT 알고리즘 혼동 공격(None/RS256↔HS256) 방어 여부
```

---

## 3. 데이터 흐름 · 저장소 아키텍처 분석

```text
이 플랫폼은 7개의 저장소를 사용합니다:
  SQLite(D1), PostgreSQL, Redis, Cloudflare KV, Cloudflare R2, ChromaDB, SurrealDB

3-1. 저장소별 역할 매트릭스
  - 각 저장소가 담당하는 데이터 도메인을 완전히 열거하세요.
  - 정식 저장소(canonical) vs 캐시(cache) vs 복제본(replica) 관계를 명시하세요.
  - data-ownership.js 계약과 실제 구현이 일치하는지 교차 검증하세요.

3-2. 데이터 일관성 분석
  - D1(Edge)과 PostgreSQL(Origin) 간 analytics 데이터 동기화 방식:
    - 크론잡 주기(매일 06:00 UTC)가 데이터 정합성에 미치는 영향
    - editor_picks 선정 로직의 레이스 컨디션 가능성
    - post_views 90일 퍼지와 통계 정확성 간의 관계
  - Redis 캐시 무효화(invalidation) 전략의 완전성
    - HTTP 캐시(httpCache.js)와 Redis 캐시의 TTL 불일치 가능성
    - 캐시 스탬피드(thundering herd) 방어 여부

3-3. 마이그레이션 전략 분석
  - D1 마이그레이션(workers/migrations/0001~0023)의 롤백 안전성
  - PostgreSQL 마이그레이션(runMigrations)의 트랜잭션 보장 여부
  - 스키마 버전 추적 방식

3-4. 벡터 DB (ChromaDB) 통합 분석
  - 임베딩 모델(qwen3-embedding-8b)과 컬렉션 관리 방식
  - RAG 파이프라인: 문서 인제스트 → 청킹 → 임베딩 → 검색 → 컨텍스트 주입 전체 흐름
  - 임베딩 드리프트(모델 변경 시) 대응 전략 존재 여부

3-5. R2 객체 관리 분석
  - r2-gateway의 Public vs Internal 접근 분리 구현 검증
  - ETag/If-Match 기반 낙관적 동시성 제어의 정확성
  - 고아 객체(orphaned objects) 정리 메커니즘 존재 여부
```

---

## 4. 서비스 경계 · 계약(Contract) 거버넌스 분석

```text
shared/src/contracts/ 모듈이 시스템 전체의 아키텍처 계약을 정의합니다.

4-1. 서비스 경계 정합성 검증
  - service-boundaries.js의 35개 라우트 경계 선언과 실제 라우트 등록을 비교하세요:
    - backend/src/routes/registry.js의 PUBLIC_ROUTE_REGISTRY + PROTECTED_ROUTE_REGISTRY
    - workers/api-gateway/src/routes/registry.ts의 WORKER_ROUTE_REGISTRY
  - 누락되거나 불일치하는 경계가 있는지 확인하세요.
  - canProxyPath()의 프록시 허용/차단 로직이 경계 선언과 일치하는지 검증하세요.

4-2. 계약 커버리지 분석
  - Zod 스키마(common, auth, translation, notifications, async-jobs)가 실제 API 엔드포인트에서
    얼마나 활용되고 있는지 커버리지를 측정하세요.
  - 스키마 없이 raw JSON을 주고받는 엔드포인트를 식별하세요.
  - 프론트엔드의 TypeScript 타입과 shared 계약 간 동기화 상태를 점검하세요.

4-3. 플랫폼 설정 계약 검증
  - platform-config.js가 선언하는 10개 설정 항목과 실제 사용처를 대조하세요:
    - k3s/secret-example.yaml
    - k3s/configmap.yaml
    - .gh_env.example
    - 각 worker의 wrangler.toml
    - backend/src/config/schema.js
  - 선언되지 않았지만 실제로 사용 중인 설정이 있는지 찾으세요.
  - 환경별(dev/staging/prod) 설정 분기 전략의 일관성을 평가하세요.

4-4. 워커 배포 계약 검증
  - workers.js의 WORKER_DEPLOYMENTS 선언과 .github/workflows/deploy-workers.yml의
    매트릭스 정의가 일치하는지 검증하세요.
  - requiredSecrets 선언과 실제 wrangler secret put 명령의 일치 여부를 확인하세요.
```

---

## 5. 에러 핸들링 · 복원력(Resilience) · 장애 전파 분석

```text
5-1. 에러 핸들링 아키텍처
  - backend/src/middleware/errorHandler.js의 에러 분류 체계 분석:
    - AppError 서브클래스(NotFoundError, ValidationError, UnauthorizedError 등) 전체 목록
    - Zod 유효성 검증 에러의 클라이언트 노출 방식
    - 예상치 못한 에러(500)의 스택 트레이스 노출 방지 여부
  - Worker 계층(api-gateway)의 에러 핸들링 패턴 분석
  - 프론트엔드의 ErrorBoundary 커버리지 분석

5-2. 서킷 브레이커 · 재시도 패턴
  - 외부 서비스(AI API, GitHub API, Consul 등) 호출 시:
    - 타임아웃 설정 적절성
    - 재시도 전략(지수 백오프 등) 존재 여부
    - 서킷 브레이커 구현 여부 (constants.js의 CIRCUIT_BREAKER 설정 실제 적용 확인)
  - Redis 연결 실패 시 폴백 경로 (in-memory 폴백 등)
  - PostgreSQL 연결 실패 시 graceful degradation 방식

5-3. 레이트 리밋 통합 분석
  - backend의 express-rate-limit과 worker의 KV 기반 레이트 리밋 간의 관계
  - 터미널 게이트웨이의 슬라이딩 윈도우 레이트 리밋 정확성
  - AI 요청의 사용자별 레이트 리밋(rate-limiter.service.js) 구현 분석
  - 레이트 리밋 우회 가능한 경로가 있는지 점검

5-4. 장애 전파 방지
  - 단일 서비스 장애가 전체 시스템에 미치는 영향 범위 분석:
    - Redis 다운 → 어떤 기능이 영향받는가?
    - PostgreSQL 다운 → 어떤 기능이 영향받는가?
    - ChromaDB 다운 → 어떤 기능이 영향받는가?
    - Cloudflare KV 장애 → 어떤 기능이 영향받는가?
  - 각 장애 시나리오에 대한 현재 graceful degradation 수준 평가
```

---

## 6. 성능 · 확장성 분석

```text
6-1. Edge 캐싱 전략
  - api-gateway에서 Cache-Control 헤더를 설정하는 모든 경로를 열거하세요.
  - R2 정적 자산의 캐시 정책(immutable, max-age=31536000) 적절성 평가
  - SEO 게이트웨이의 posts-manifest.json 5분 캐시가 콘텐츠 신선도에 미치는 영향

6-2. 데이터베이스 쿼리 성능
  - D1 마이그레이션에서 생성된 인덱스 목록을 추출하고, 주요 쿼리 패턴과 대조하세요.
  - PostgreSQL의 post_visits / post_stats_pg 테이블의 인덱스 전략 평가
  - N+1 쿼리 패턴이 존재하는지 repository 계층을 점검하세요.

6-3. 번들 사이즈 · 프론트엔드 성능
  - Vite의 manualChunks 전략(vendor, ui, markdown, utils, search)이 최적인지 평가하세요.
  - React.lazy + Suspense 코드 스플리팅의 적용 범위를 확인하세요.
  - 거대한 의존성(예: xterm, marked, katex, shiki 등)의 번들 영향도 분석

6-4. WebSocket · SSE 확장성
  - 채팅 WebSocket 연결의 동시 접속 한계와 메모리 영향 분석
  - 알림 SSE(Server-Sent Events)의 연결 수 제한 및 역압(backpressure) 처리 방식
  - 터미널 세션의 단일 사용자 제한(hasActiveSession) 우회 가능성

6-5. K3s 리소스 제약 분석
  - LimitRange(500m CPU, 512Mi)와 ResourceQuota(총 8 CPU, 16Gi)가
    현재 서비스 구성(8개 Pod)에 충분한지 평가하세요.
  - AI 워커(ai-worker.js)의 리소스 사용 패턴과 사이드카 구조의 적절성
  - PostgreSQL StatefulSet의 단일 레플리카 구성의 위험성 평가
```

---

## 7. CI/CD · 배포 파이프라인 분석

```text
7-1. 파이프라인 안전성
  - 3개 워크플로우(deploy-blog-workflow, deploy-workers, deploy) 각각의:
    - 트리거 조건(path filter)에 빈틈이 있는지 (shared/ 변경 시 어떤 파이프라인이 실행되는가?)
    - 롤백 전략 존재 여부
    - 실패 시 알림 메커니즘
  - ArgoCD Image Updater의 SHA 태그 선택 전략이 안전한지 (정규식 ^[0-9a-f]{7}$의 충돌 가능성)

7-2. 시크릿 주입 분석
  - deploy-workers.yml의 매트릭스별 secret injection이 과잉/누락 없이 정확한지 검증
  - GitHub Actions에서 wrangler secret put으로 주입하는 시크릿이
    wrangler.toml의 [vars] 선언과 충돌하지 않는지 확인

7-3. 프론트엔드 배포 원자성
  - deploy.yml에서 SEO/매니페스트 생성 → auto-commit → build → deploy 순서에서
    race condition 가능성 분석 (동시 push 시 rebase 실패 등)
  - GitHub Pages 배포와 gh-pages 브랜치 force-push 간의 정합성

7-4. 이미지 빌드 전략
  - 멀티스테이지 Dockerfile 최적화 상태 점검
  - Docker 레이어 캐싱 효율성 (package*.json COPY 분리 여부 등)
  - blog-api와 blog-terminal 이미지의 베이스 이미지 보안 상태
```

---

## 8. 코드 품질 · 아키텍처 패턴 분석

```text
8-1. 클린 아키텍처 마이그레이션 상태
  - backend/src/application/ 디렉토리의 포트-어댑터 패턴 적용 현황:
    - 현재 4개 포트(comment-repository, notification-stream, post-reader, session-token-store)
    - 실제 라우트에서 usecase/service를 사용하는 비율 vs 직접 repository 호출 비율
    - DI 컨테이너(bootstrap/container.js)의 확장 계획 평가
  - 나머지 라우트들의 마이그레이션 우선순위 제안

8-2. 코드 중복 · 레거시 분석
  - lib/ vs services/ 간의 중복 코드 식별:
    - lib/ai-service.js (DEPRECATED) vs services/ai/ai.service.js
    - lib/openai-compat-client.js (DEPRECATED) vs services/ai/openai-client.service.js
    - lib/agent/ vs services/agent/ 간의 관계와 마이그레이션 상태
  - 프론트엔드에서 사용하지 않는 dead code 식별 (미사용 컴포넌트, 미사용 서비스 함수)

8-3. 타입 안전성 분석
  - Worker(TypeScript) ↔ Backend(JavaScript + JSDoc) ↔ Frontend(TypeScript) 간
    타입 경계에서의 안전성 평가
  - shared/ 계약이 TypeScript .d.ts를 제공하지 않는 것의 영향
  - Backend의 JavaScript → TypeScript 마이그레이션 필요성 및 우선순위 평가

8-4. 테스트 커버리지 분석
  - 현재 존재하는 테스트 파일을 모두 찾고 종류를 분류하세요 (unit / integration / e2e / characterization)
  - 테스트가 없는 핵심 모듈을 식별하고 우선순위를 매기세요
  - 프론트엔드 Playwright E2E 테스트의 범위 평가
```

---

## 9. 보안 심층 분석

```text
9-1. 공격 표면(Attack Surface) 매핑
  - 인증 없이 접근 가능한 모든 엔드포인트를 열거하세요:
    - Public 라우트 (notifications SSE)
    - healthz, public/config, metrics
    - R2 public asset paths
    - SEO 게이트웨이 전체
  - 각 공개 엔드포인트의 정보 노출 수준 평가

9-2. 입력 검증 완전성
  - Zod 스키마(middleware/schemas/)가 적용된 라우트 vs 적용되지 않은 라우트 비율
  - SQL Injection 방어: 파라미터화된 쿼리 사용 일관성 (D1 + PostgreSQL)
  - XSS 방어: 마크다운 렌더링 시 sanitization 처리 방식
  - Path Traversal: R2 키 구성 시 사용자 입력 검증 여부

9-3. 시크릿 관리 보안
  - 하드코딩된 시크릿이나 디폴트 크레덴셜이 존재하는지 코드베이스 전체 스캔
  - .gitignore가 모든 민감 파일(.env, *.pem 등)을 커버하는지 확인
  - config/constants.js에 민감 정보가 포함되어 있는지 점검

9-4. 컨테이너 보안 (터미널 샌드박스)
  - Docker 샌드박스 보안 설정의 충분성 분석:
    - --network=none, --cap-drop=ALL, --read-only, --no-new-privileges
    - tmpfs 크기 제한(64MB)의 적절성
    - PID 제한(50)의 적절성
    - 컨테이너 이스케이프 가능성 평가
  - DinD(Docker-in-Docker) 사이드카의 보안 위험 (privileged 모드)

9-5. CORS · CSP 정책 분석
  - CORS 허용 출처(allowedOrigins) 설정의 적절성
  - CSP(Content-Security-Policy) 헤더 설정 현황 (helmet 기본값 vs 커스텀)
  - cross-origin-resource-policy: "cross-origin" 설정의 보안 영향

9-6. 의존성 보안
  - 주요 의존성의 알려진 취약점(CVE) 스캔 권장
  - 고위험 의존성 식별: node-pty, better-sqlite3, sharp 등 네이티브 모듈
```

---

## 10. 관찰성(Observability) · 운영 분석

```text
10-1. 로깅 아키텍처
  - 구조화 로깅(lib/logger.js)의 로그 레벨 전략과 PG 영속화 방식
  - Worker 계층의 로깅(middleware/logger.ts)과 백엔드 로깅의 상관 관계
  - requestId / traceId / spanId 전파의 일관성 검증
  - 로그에서 PII(개인식별정보) 마스킹이 적용되고 있는지 점검

10-2. 메트릭 · 모니터링
  - Prometheus 메트릭(lib/metrics.js)의 커버리지:
    - HTTP 요청 지속시간, 상태 코드 분포
    - Redis 연결 상태, AI 큐 깊이
    - 누락된 핵심 메트릭(DB 연결 풀 사용률, 메모리, 이벤트 루프 지연 등) 식별
  - /metrics 엔드포인트의 접근 제어 상태 (현재 인증 없음)

10-3. 분산 추적(Distributed Tracing)
  - AI 요청 추적(middleware/tracing.ts → D1 ai_traces)의 범위와 한계
  - 백엔드-워커 간 requestId 전파가 end-to-end로 작동하는지 확인
  - 추적 데이터 보존 기간 및 정리 메커니즘

10-4. 알럿 · 인시던트 대응
  - 현재 설정된 알럿 규칙이 있는지 확인 (Prometheus Alertmanager, CF Notifications 등)
  - 장애 감지부터 복구까지의 관찰성 갭(gap) 식별
  - 런타임 설정 변경(Consul KV) 시 감사 로그(audit log) 존재 여부
```

---

## 11. 개선 로드맵 종합 제안

```text
위 1~10번의 분석 결과를 종합하여 다음을 작성하세요:

11-1. 즉시 조치 필요 (Critical/High 항목)
  - 보안 취약점, 데이터 정합성 위험, 장애 전파 위험 중심
  - 각 항목에 대한 구체적 수정 방안과 예상 작업량(시간 단위)

11-2. 단기 개선 (1~2주)
  - 코드 품질, 테스트 커버리지, 관찰성 개선 중심
  - 우선순위 순서로 정렬

11-3. 중기 개선 (1~3개월)
  - 아키텍처 진화: 클린 아키텍처 마이그레이션 완료, 타입스크립트 전환 등
  - 확장성 개선: DB 레플리카, 캐시 전략 고도화 등

11-4. 장기 비전 (3개월+)
  - 마이크로서비스 분리 가능성 평가
  - 멀티 리전 배포 전략
  - 비용 최적화 제안 (Cloudflare Workers vs Origin 트래픽 비율 최적화)

11-5. 아키텍처 의사결정 기록(ADR) 템플릿
  - 위 개선 항목 중 주요 결정 3개를 ADR 형식으로 작성하세요:
    - 제목, 상태, 컨텍스트, 결정, 결과, 대안
```

---

## 부록: 단일 주제 심층 분석용 프롬프트 (독립 사용 가능)

### A. AI 서비스 아키텍처 심층 분석

```text
backend/src/services/ai/ 디렉토리와 관련 파일을 분석하세요:

1. 멀티 프로바이더 라우팅 (multi-provider.service.js):
   - 모델 선택 로직, 폴백 전략, 비용 최적화 방식
2. 동적 설정 (dynamic-config.service.js):
   - Worker에서 AI 모델을 오버라이드하는 메커니즘
3. 태스크 큐 (task-queue.service.js):
   - Redis 기반 비동기 AI 작업 처리 흐름
   - ai-worker.js 사이드카와의 작업 분배 방식
4. 레이트 리밋 (rate-limiter.service.js):
   - 사용자별/전역 AI 요청 제한 전략
5. 쿼리 확장 (query-expander.service.js):
   - RAG 검색 쿼리 확장 알고리즘
6. 에이전트 시스템 (services/agent/):
   - coordinator.service.js의 도구 오케스트레이션 방식
   - tools/ 디렉토리의 각 도구(blog-ops, code-exec, MCP, RAG, web-search) 분석
   - MCP(Model Context Protocol) 클라이언트 통합 분석
```

### B. 프론트엔드 서비스 계층 심층 분석

```text
frontend/src/services/ 의 포트-어댑터 패턴을 분석하세요:

1. core/ 추상화 계층:
   - HttpPort / FetchHttpAdapter의 설계 적절성
   - AuthTokenPort 구현체 간의 전환 로직
   - SSE 추상화(sse.port.ts, sse-frame.ts)의 에러 복구 전략
2. 도메인별 서비스 모듈의 응집도와 결합도 평가
3. TanStack Query와 서비스 계층의 통합 패턴
4. 오프라인/네트워크 에러 시의 사용자 경험 처리
```

### C. Kubernetes 운영 심층 분석

```text
k3s/ 디렉토리의 전체 매니페스트를 분석하세요:

1. Pod 안티어피니티 / 토폴로지 분산 설정 존재 여부
2. PVC(Persistent Volume Claim)의 스토리지 클래스와 백업 전략
3. init 컨테이너(alpine/git)의 보안 위험 (git clone at deploy time)
4. Piston 코드 실행 엔진의 privileged 모드 위험과 대안
5. ArgoCD sync wave / hook 설정의 적절성
6. NetworkPolicy 존재 여부 (Pod 간 네트워크 격리)
7. HPA(Horizontal Pod Autoscaler) 부재의 영향
```

---

> **팁**: 각 섹션의 분석 결과를 `docs/architecture/analysis/` 디렉토리에
> 섹션별로 저장하면 아키텍처 의사결정 추적에 유용합니다.