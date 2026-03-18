# 코드 최적화 분석 보고서

> 참고: 이 문서의 공개 호스트명과 운영 주소 예시는 모두 비식별 placeholder입니다.

> 작성일: 2026-03-16  
> 분석 범위: Frontend (React SPA), Backend (Node.js/Express), Cloudflare Workers (API Gateway)  
> 분석 방법: 정적 코드 분석 + Explore 에이전트 2개 + Oracle 검증

---

## 1. 시스템 아키텍처 개요

```
[Client Browser]
    ↓ HTTPS
[Cloudflare Edge]
    ├── api-gateway (api.example.com) — Hono, D1/R2/KV, 백엔드 프록시
    ├── r2-gateway (assets.example.com) — R2 정적 에셋 서빙
    ├── seo-gateway (blog.example.com) — 크롤러용 메타태그 주입
    └── terminal-gateway (terminal.example.com) — WebSocket 프록시
    ↓ Cloudflare Tunnel
[Origin Backend] (origin.example.com)
    └── Node.js 20 + Express, Sharp, ChromaDB, Redis, AI upstream
[Frontend] (blog.example.com)
    └── React 18 SPA, Vite 5, GitHub Pages
```

---

## 2. 분석 요약

### 2.1 관측된 사실 (Observed Facts)

| 영역 | 파일 | 줄 | 설명 |
|------|------|----|------|
| Frontend | `postService.ts` | 217 | 프로덕션에서 `?v=${Date.now()}` + `cache: 'no-cache'`로 223 KB manifest를 매 요청마다 재다운로드 |
| Frontend | `App.tsx` | 47 | `QueryClient`가 기본값(`staleTime: 0`)으로 생성 — 불필요한 중복 fetch 유발 |
| Frontend | `CommentSection.tsx` | 47 | `{ eager: true }` glob으로 archived JSON을 빌드 타임에 번들에 포함 |
| Frontend | `vite.config.ts` | 37–42 | `ui` 청크에 4개 Radix 패키지만 포함 — 나머지 23개가 다른 청크에 산재 |
| Frontend | `BlogPost.tsx` | 266–583 | 포스트 로드 후 6개 effect가 순차적으로 실행: 분석 기록, localStorage, 시뮬레이터 탐지, 번역, 관련 포스트, 시리즈 |
| Frontend | `Insight.tsx` | 126–206 | Dijkstra(`pq.sort()` 루프 내) + 150회 반복 force simulation + canvas 렌더링 모두 메인 스레드에서 실행 |
| Frontend | `TableOfContents.tsx` | 45–177 | 스크롤/리사이즈 시 `getBoundingClientRect`, `offsetTop` 읽기 + RAF 스케줄링 |
| Frontend | `OptimizedImage.tsx` | 60 | 이미지 인스턴스마다 `IntersectionObserver` 개별 생성 |
| Frontend | `postService.ts` | 217 | `getManifestItems()`에 `manifestCache` 메모리 가드 존재 — 페이지 내 중복 요청은 방지됨 |
| Frontend | `deploy.yml` | — | CI에 번들 크기 예산 게이트 없음 |
| Backend | `posts.js` | 113, 134, 151, 209–216 | 요청 핸들러에서 `readdirSync`, `readFileSync`, `writeFileSync` 사용 |
| Backend | `images.js` | 81–128, 172–186, 246–293 | 이미지 업로드 시 Sharp resize/WebP 변환 + AI vision 분석을 동기 요청 경로에서 실행 |
| Workers | `index.ts` | 96–114 | AI/chat/image 경로마다 `getAiDefaultModel()`, `getAiVisionModel()` 비동기 config 읽기 후 프록시 |
| Workers | `ai-service.ts` | 111–126 | `buildHeaders()` 호출마다 `Promise.all([apiKey, model, visionModel])` 재조회 |
| Workers | `images.ts` | 184, 198 | chat-upload에서 전체 이미지 버퍼를 `btoa(String.fromCharCode(...new Uint8Array(buffer)))`로 base64 변환 |

### 2.2 추론 (Inference)

- 가장 큰 사용자 체감 지연: 공개 페이지의 **렌더 워터폴** — SPA 마운트 후 effect로 데이터 로딩, TanStack Query 미활용
- 가장 큰 네트워크 낭비: **manifest 캐시 무효화 버그** — 배포 후에도 매 방문마다 223 KB 재다운로드
- 가장 큰 백엔드 이벤트 루프 위험: **동기 FS 코드** (`readdirSync`, `readFileSync`) + 인라인 Sharp 처리
- 가장 큰 Worker CPU 낭비: **요청마다 config/헤더 재조회** (60s 캐시가 있지만 call-site 최적화 부재)

---

## 3. 우선순위 최적화 로드맵

### P0 — 낮은 위험, 높은 ROI (즉시 실행)

#### P0-1: Manifest 캐시 전략 수정 ✅ 완료
- **파일**: `frontend/src/services/content/postService.ts:217`
- **변경**: `?v=${Date.now()}` 제거 + `cache: 'no-cache'` → `cache: 'default'`
- **효과**: 브라우저 조건부 요청(304) 활성화 → 재방문 시 223 KB 절약
- **안전성**: `manifestCache` 메모리 가드가 페이지 내 중복 요청을 이미 방지. 배포 후 Cloudflare CDN이 새 콘텐츠 서빙.

#### P0-2: QueryClient 기본 옵션 설정 ✅ 완료
- **파일**: `frontend/src/App.tsx:47`
- **변경**: `staleTime: 2분`, `gcTime: 10분`, `retry: 1`, `refetchOnWindowFocus: false`
- **효과**: admin 페이지의 중복 fetch 감소. 공개 페이지에서 `useQuery` 도입 시 즉시 적용.
- **안전성**: 공개 페이지는 현재 `useQuery` 미사용 — 충돌 없음

#### P0-3: Archived Comment JSON Lazy 로딩 ✅ 완료
- **파일**: `frontend/src/components/features/blog/CommentSection.tsx:47`
- **변경**: `{ eager: true }` → 기본값(lazy) + async `getArchivedFor()` + `useEffect` 비동기 로딩
- **효과**: `data/comments/` 디렉토리에 JSON 추가 시 번들 비대화 방지
- **안전성**: 현재 파일 0개 — 무위험. `useMemo` 불필요한 import 제거.

#### P0-4: Vite UI Chunk 완성 ✅ 완료
- **파일**: `frontend/config/vite.config.ts:37`
- **변경**: `ui` 청크에 전체 Radix UI 27개 패키지 포함
- **효과**: Radix 코드가 단일 `ui.js`로 묶여 브라우저 캐시 활용도 향상
- **안전성**: Vite manual chunk 분할 — 빌드 시 검증됨

#### P0-5: CI 번들 크기 리포트 추가 ✅ 완료
- **파일**: `.github/workflows/deploy.yml`
- **변경**: 빌드 후 JS/CSS 청크 크기 출력 step 추가
- **효과**: 번들 리그레션을 CI 로그에서 즉시 확인 가능
- **안전성**: 읽기 전용 `find` + `du` — 빌드 실패 시 dist 없어도 non-blocking (추후 budget gate 추가 가능)

---

### P1 — 중간 비용, 높은 ROI (다음 스프린트)

#### P1-1: BlogPost 사이드 이펙트 최적화
- **파일**: `frontend/src/pages/public/BlogPost.tsx:303–583`
- **현황**: 포스트 로드 후 6개 effect 순차 실행 (analytics, localStorage, simulator probe, translation, related posts, series)
- **제안**: analytics/localStorage는 `queueMicrotask` 또는 `setTimeout(fn, 0)`으로 비크리티컬 작업 지연. 관련 포스트/시리즈 로딩을 `Suspense` 경계로 격리.

#### P1-2: TableOfContents 레이아웃 최적화
- **파일**: `frontend/src/components/features/blog/TableOfContents.tsx:45–177`
- **현황**: 스크롤마다 `getBoundingClientRect()` + `offsetTop` 읽기 → layout thrashing 위험
- **제안**: 스크롤 감지는 현재 RAF + throttle(100ms)이 있음. 헤딩 추적을 `IntersectionObserver`로 전환 시 스크롤 핸들러에서 `getBoundingClientRect` 제거 가능.

#### P1-3: IntersectionObserver 공유
- **파일**: `frontend/src/components/common/OptimizedImage.tsx:60`
- **현황**: 이미지마다 개별 `IntersectionObserver` 생성
- **제안**: 모듈-레벨 싱글턴 `IntersectionObserver`에 모든 이미지를 `observe()`로 등록 — 또는 네이티브 `loading="lazy"` 속성 활용 (95%+ 브라우저 지원)

#### P1-4: Worker AI 요청 헤더 캐싱
- **파일**: `workers/api-gateway/src/lib/ai-service.ts:111–126`
- **현황**: 요청마다 `buildHeaders()`에서 `Promise.all([apiKey, model, visionModel])` 재조회
- **제안**: 요청 스코프나 Worker 인스턴스 캐시에 헤더 결과 저장 (60s TTL은 이미 있음, but call-site마다 재조회)

---

### P2 — 높은 비용, 높은 임팩트 (장기)

#### P2-1: Insight 그래프 Web Worker 이전
- **파일**: `frontend/src/pages/public/Insight.tsx:126–206`
- **현황**: Dijkstra(`O(n² log n)` pq.sort) + 150회 force simulation이 메인 스레드에서 실행
- **제안**: `new Worker()`로 레이아웃 계산 오프로드. 또는 그래프 레이아웃 데이터를 빌드 타임에 사전 계산.

#### P2-2: 백엔드 동기 FS 제거
- **파일**: `backend/src/routes/posts.js:113, 191`, `backend/src/routes/images.js:172`
- **현황**: `readdirSync`, `readFileSync`가 Express 요청 핸들러에서 직접 호출 → Node.js 이벤트 루프 블록
- **제안**: `fs.promises.readdir`, `fs.promises.readFile`로 교체. `backend/src/services/posts.service.js`의 서비스 레이어에 집중.

#### P2-3: 이미지 업로드와 Vision 분석 분리
- **파일**: `backend/src/routes/images.js:246–293`
- **현황**: 이미지 업로드 + Sharp 처리 + AI vision 분석이 동일 요청 경로에서 순차 실행
- **제안**: 업로드 응답 즉시 반환 후 vision 분석은 비동기 큐로 처리. 결과는 폴링 또는 SSE로 전달.

---

### P3 — 아키텍처 강화 (중장기)

#### P3-1: "비동기" AI 태스크 큐 재설계
- **파일**: `backend/src/services/ai/ai.service.js:183–221`, `backend/src/services/ai/task-queue.service.js:84–109`
- **현황**: "async" 모드임에도 BLPOP으로 결과를 기다려 HTTP 요청이 열려있는 동안 대기
- **제안**: 클라이언트가 폴링하거나 SSE로 구독하는 패턴으로 전환 — HTTP 연결 해제 후 태스크 처리

#### P3-2: 공개 페이지 데이터 로딩 전략
- **현황**: `Index`, `Blog`, `BlogPost` 모두 마운트 후 `useEffect`로 데이터 로딩 → 렌더 워터폴
- **제안**: TanStack Query `useQuery`로 전환하여 중복 요청 방지 + 캐시 공유. 장기적으로 React Router v6 `loader`와 통합.

---

## 4. 파일별 변경 이력 (P0)

### 4.1 변경된 파일

| 파일 | 변경 유형 | 핵심 변경 |
|------|----------|----------|
| `frontend/src/services/content/postService.ts` | 버그픽스 | manifest fetch: `no-cache` + 타임스탬프 → `default` |
| `frontend/src/App.tsx` | 성능 | QueryClient staleTime/gcTime/retry 설정 |
| `frontend/src/components/features/blog/CommentSection.tsx` | 리팩터링 | eager glob → lazy glob, sync → async, useMemo 제거 |
| `frontend/config/vite.config.ts` | 빌드 최적화 | ui chunk에 모든 Radix UI 패키지 포함 |
| `.github/workflows/deploy.yml` | CI 개선 | 번들 크기 리포트 step 추가 |

---

## 5. 미검증 항목

| 항목 | 이유 |
|------|------|
| 실제 번들 크기 (KB) | 로컬 `dist/` 없음 — CI 빌드 후 확인 필요 |
| LCP / CLS / INP 수치 | 실제 트레이스 없음 — Chrome DevTools / Lighthouse로 측정 필요 |
| P95/P99 백엔드 응답시간 | 로그/APM 없음 — 프로덕션 배포 후 측정 필요 |
| Worker CPU 시간 개선 폭 | Cloudflare Dashboard wrangler tail 로그 필요 |

---

## 6. 기술 부채 현황

### 6.1 ADR (Architecture Decision Records)

**ADR-1: Manifest 캐시 전략**
- 결정: `cache: 'default'` (조건부 요청)
- 근거: CI 배포마다 파일이 갱신되므로 CDN이 ETag 기반으로 새 버전 서빙 가능
- 미래 개선: 빌드 해시를 파일명에 포함 (`posts-manifest.[hash].json`) 시 영구 캐시(`immutable`) 가능

**ADR-2: QueryClient 기본값**
- 결정: `staleTime: 2분`, `gcTime: 10분`
- 근거: 블로그 콘텐츠는 자주 바뀌지 않음; 탭 전환마다 refetch 불필요
- 미래 개선: admin 페이지에 `queryKey`별 `staleTime: 0` 오버라이드 고려

**ADR-3: Archived Comment 로딩**
- 결정: lazy glob (동적 import)
- 근거: `data/comments/` 현재 비어있음; 향후 JSON 추가 시 번들에 포함되지 않도록 예방
- 미래 개선: 실제 archived JSON이 추가되면 로딩 상태 UX 검토

---

## 7. 관련 파일 목록

### P0 수정 파일
- `frontend/src/services/content/postService.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/features/blog/CommentSection.tsx`
- `frontend/config/vite.config.ts`
- `.github/workflows/deploy.yml`

### P1–P2 분석 대상 파일
- `frontend/src/pages/public/BlogPost.tsx`
- `frontend/src/pages/public/Insight.tsx`
- `frontend/src/components/features/blog/TableOfContents.tsx`
- `frontend/src/components/common/OptimizedImage.tsx`
- `backend/src/routes/posts.js`
- `backend/src/routes/images.js`
- `backend/src/services/image.service.js`
- `workers/api-gateway/src/lib/ai-service.ts`
- `workers/api-gateway/src/routes/images.ts`
- `workers/api-gateway/src/index.ts`

### 참고 파일
- `backend/src/services/ai/ai.service.js`
- `backend/src/services/ai/dynamic-config.service.js`
- `backend/src/services/ai/task-queue.service.js`
- `frontend/src/services/content/postService.ts`
- `frontend/src/pages/public/Index.tsx`
- `frontend/src/pages/public/Blog.tsx`
