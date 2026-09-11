# PR-A01 — SEO 게이트웨이 구현 기록

기준일: 2026-09-10 KST. 기준 입력: `blog-integrated-with-pr-tasks-20260910.zip`.
입력 SHA-256: `2a4cedfdaf47def72355ac87d5923920a20113390437f9719a55a00ba6fcade3`.

## 반영 범위

**A01 제품 소스와 테스트 연결을 수정했다. 분리된 Node 테스트 112개와 기존 Reader 이미지 계약 테스트 26개가 통과했다. 실제 Workers HTMLRewriter 실행, 잠금 의존성 기준 전체 타입 검사, staging·운영 응답은 아직 검증하지 못했다.** 원격 PR 생성·병합·배포·유료 AI 요청은 수행하지 않았다.

메모장·AI Chat·AI 토론·사용자 AI 설정·비회원 하루 5장 이미지 한도 코드는 이번 작업에서 수정하지 않았다. 기존 소스를 다시 만들거나 덮어쓰지 않고 최신 통합본에 A01만 적용했다.

## 이전과 이후

| 대상 | 이전 통합본 | 이번 변경 |
|---|---|---|
| 검색봇의 파일 요청 | crawler 분기에서 robots·sitemap·이미지 등에도 index HTML | UA 판별 전에 파일 분기. 일반 UA·Googlebot·Bingbot이 같은 경로를 사용 |
| origin 선택 | 확장자·prefix와 캐시 규칙이 혼재 | Pages의 빌드/제어 파일과 raw 원문의 선택을 캐시 정책과 분리 |
| 캐시 | robots·sitemap·변경 가능한 이미지에도 1년 immutable 가능 | 제어 파일·원문은 재검증, 변경 가능한 자산은 최대 300초. `/assets/`의 8자리 해시형 번들만 장기 캐시 후보이며 명시된 origin TTL은 늘리지 않음 |
| 파일 HTTP 응답 | GET 중심, validator 전달 누락 | GET/HEAD, ETag·Last-Modified, 조건부 304, Range·If-Range·206 및 실제 바이트 보존 |
| MIME | 요청 확장자로 정상 origin MIME도 덮어씀 | 제공된 MIME 보존, 누락된 MIME만 보완. 비HTML 파일 요청에 명시적으로 HTML이 반환되면 502 |
| 글 식별 | 인코딩된 slug를 그대로 비교, 없는 글 제목을 추측 | URL segment 한 번 디코딩 후 NFC로 공개 manifest와 비교. 없는 글·비공개 글은 404 |
| URL 정규화 | `/projects`가 홈 canonical, 별칭이 분산 | `/projects` self-canonical. `/post/`·`/posts/` 글 별칭, 후행 slash·NFD 표기는 검증된 canonical로 308 |
| 클라이언트 route 일치 | `/contact`와 관리자/오류 경로 구분 미흡 | `/contact`는 실제 앱처럼 `/about`로 연결. 현재 App.tsx route 전체와 자동 대조 |
| 장애 | origin 실패를 404 또는 홈 200으로 표현 | manifest·원본의 5xx 구분. manifest 404는 전체 글 삭제 증거가 아니므로 503; 알려진 페이지의 shell 404는 502 |
| head | canonical 중복·description 누락·이전 기사 태그 잔존 | 소유 태그를 지운 후 title·description·canonical 각각 하나 삽입. 주입 값 escaping 및 article tag 중복 제거 |
| HTML header | 공통 index의 ETag·길이가 변환 페이지에 재사용 | 변환 페이지의 원본 validator/길이 제거. 조건부 페이지 요청도 현재 metadata로 200 응답; 파일 validator는 유지 |
| 비공개 화면 | 관리자 페이지 shell의 일반 캐시 가능 | 기존 관리자 화면 자체는 보존하고 no-store·noindex 적용. 관리자 인증을 대체하는 기능은 아님 |

### origin과 경로 정책

`robots.txt`, sitemap, RSS/Atom, manifest control 파일은 `GITHUB_PAGES_ORIGIN`의 빌드 산출물로 전달한다. `posts-manifest.json`, `projects-manifest.json`, 게시글 Markdown과 연도별 manifest 등 콘텐츠 데이터는 `RAW_CONTENT_ORIGIN`을 사용한다. raw origin이 없으면 기존처럼 Pages origin을 사용한다.

`/assets/`, `/images/`, `/ai-memo/`, `/fonts/`, `/demos/` 같은 빌드 자산 prefix는 JSON 확장자가 있더라도 Pages origin을 사용한다. `/blog/2026/node.js`는 글이고 `/posts/2026/example-simulator.html`은 실제 파일이다. `/post/2026/slug/index.html`은 공개 글을 확인한 뒤 canonical로 연결한다.

성공 manifest만 origin별로 최대 5분 캐시한다. 공개/비공개 flag 타입, year·slug·title, 중복 normalized ID, total 불일치를 검증한다. 유효기간이 지난 manifest를 새 origin 장애 때 영구 정답처럼 쓰지 않는다. 이 캐시는 최대 5분간 공개 목록 변경 반영을 늦출 수 있으므로 배포 및 비공개 전환 검증에 포함해야 한다.

파일 요청은 사용자 Cookie·Authorization·Referer·내부 키를 공개 origin으로 전달하지 않는다. index를 변환한 응답에서는 원본 HTTP Link 중 canonical 관계만 제거하고 preload·alternate 같은 나머지 링크와 원본 CSP를 보존한다. 이미 더 엄격한 CSP를 기본 정책으로 약화시키지 않는다.

### A01에서 바꾸지 않은 영역

실제 게시글 본문을 HTML에 미리 넣는 SSG/prerender, JSON-LD 전체 통합, 클라이언트 `useSEO`의 기사 태그 누적 정리, 언어별 페이지는 A07 범위다. A01은 **검색봇·사용자에게 같은 공개 라우팅과 올바른 metadata/상태를 전달하는 수정**이며, 본문 prerender나 검색 색인·순위 완료를 의미하지 않는다. 원본이 소유한 JSON-LD·스크립트·스타일·본문은 유지한다.

R07-1 익명 자격 재발급 소유 증명, A02 번역 실행·복구, A03 Projects 파서·재조회 문제도 그대로 남아 있다. 독자 이미지 기능 flag를 켜지 않았다. A01 통과가 개인 데이터 인증 감사 통과를 뜻하지 않는다.

## 실제 실행한 검증

| 검증 | 결과 | 범위와 기록 |
|---|---|---|
| A01 Node 분리 테스트 | 112 PASS / 0 FAIL / 0 SKIP | 실제 수정 모듈, fixture fetch, recording element handler. `verification/seo-a01/unit-tests.tap` |
| 첨부 공개 글 전체 | 공개 140개 metadata lookup 확인 | 위 112개 테스트 중 1개에서 manifest 전체 순회. 운영 사이트 읽기 시험이 아님 |
| 앱 route 대조 | App.tsx 선언 경로 대조 통과 | 글·관리자·오류 페이지; 없는 route는 정상 페이지로 위장하지 않음 |
| Reader 이미지 계약 회귀 | 26 PASS / 0 FAIL | 기존 SQLite 정책/저장소 SQL 테스트. `reader-image-regression.tap` |
| 잠금 의존성 설치 | 미완료 | `npm ci --offline`가 `ENOTCACHED`; 온라인 npm registry 접근은 DNS 오류. 패키지 부재를 제품 테스트 성공으로 계산하지 않음 |
| Workers 전체 타입 검사 | 시작 불가 | `TS2688: @cloudflare/workers-types` 부재. `typecheck-attempt.log` |
| 실제 HTMLRewriter runtime suite | 실행 전 의존성 실패 | `esbuild` 부재. `runtime-attempt.log`; 실제 runtime test case가 실행된 결과가 아님 |
| staging·운영 배포 / AI-server 호출 | 미수행 | 환경·인증정보를 임의로 만들거나 기능을 활성화하지 않음 |

Node 단위 실행은 현재 설치된 TypeScript 5.8.3으로 소스/테스트 12개를 임시 디렉터리에 CommonJS로 변환해 수행했다. 이는 잠금 파일의 TypeScript 5.9.3·tsx로 실행한 전체 workspace 결과와 다르다. 원본 소스 트리에 임시 JS 빌드를 남기지 않는다. 추가 JS/MJS/CJS와 JSON 구문 확인 및 전달본 보존 검사는 `source-checks.json`, `source-integrity.json`을 참조한다.

## 실제 runtime 테스트를 다시 빠뜨리지 않도록 한 연결

`workers/seo-gateway/test/runtime/html-rewriter.test.mjs`는 esbuild로 실제 Worker를 묶고 Miniflare/workerd의 실제 HTMLRewriter를 사용한다. HTMLRewriter를 mock/정규식 구현으로 바꾸지 않는다. 단, 외부 origin만 local fixture로 대체하므로 provider나 공개 사이트를 호출하지 않는다.

기존 잠금 파일에 이미 있던 `miniflare 4.20260409.0`과 `esbuild 0.27.3`을 테스트의 직접 의존성으로 선언했다. 기존에 잠긴 다른 패키지 버전·integrity는 변경하지 않았다. `npm test`는 `test:unit` 후 `test:runtime`을 실행하며, runtime 설치 실패를 skip 처리하지 않는다. 기존 Workers 검증·배포 workflow가 호출하는 `npm test`에 자동으로 연결된다.

## 이어서 실행할 명령

잠금 의존성을 설치할 수 있는 환경에서 **SEO workspace만** 실행한다.

```bash
cd blog/workers/seo-gateway
npm ci
npm run verify
```

Node 20.18.1 이상이 필요하다. 전달 환경에서는 Node 22.16.0을 사용했다. `npm run verify`는 타입 검사와 단위/실제 runtime 테스트를 모두 통과해야 성공한다.

의존성을 설치할 수 없지만 TypeScript compiler가 이미 있는 환경의 분리 검증:

```bash
cd blog
node scripts/verification/seo-a01-offline.cjs
# 자동 탐색이 안 되면 TYPESCRIPT_MODULE에 설치된 typescript 모듈 경로를 지정한다.
```

**offline 명령을 runtime/staging 검증의 대체 완료 증거로 사용하지 않는다.** A01의 다음 재개 지점은 실제 runtime suite와 staging origin 응답 검증이다. 이후 A02로 진행한다. R07-1은 독자 이미지 활성화 전 별도로 반드시 마무리한다.

## 기준 문서

작업 요구는 `tasks.md`의 A01과 `docs/ai-seo-audit/`에 근거한다. HTMLRewriter 및 Miniflare API 연결을 확인한 공식 자료:

- Cloudflare HTMLRewriter: https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/
- Cloudflare Miniflare fetch testing: https://developers.cloudflare.com/workers/testing/miniflare/core/fetch/

공식 API 문서 확인은 이 프로젝트의 실제 runtime 시험을 수행했다는 증거가 아니다.
