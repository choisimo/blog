# A01 검증·배포 순서

이 문서는 실행 순서다. 실제 staging/운영 반영은 아직 하지 않았다.

## 변경 경계

배포 대상은 `workers/seo-gateway`다. A01에 DB 마이그레이션은 없다. API gateway, backend, 프런트엔드 애플리케이션 코드, Reader 이미지 flags는 변경하지 않는다.

**이 snapshot에는 게시글 Markdown 원문이 없다.** `frontend/public/project-data`의 68개는 복구된 Projects 자료로, 게시글 원문을 대체하지 않는다. 프런트엔드 `prebuild`, `generate-manifests`, `generate-seo`를 실행해 정상 게시글 manifest·sitemap을 덮어쓰지 않는다.

## 1. 로컬/CI

`workers/seo-gateway`에서 `npm ci && npm run verify`를 실행한다. Node >=20.18.1. 설치·타입 검사·실제 Miniflare suite 중 하나라도 실패하면 통과로 처리하지 않는다. 기존 검증/배포 workflows가 같은 `npm test`를 실행한다. 부분적인 offline 시험은 참고 증거다.

## 2. staging 설정 확인

기존 production origin/라우트 설정은 코드에 그대로 있다. 이번 작업에서 검증되지 않은 staging URL을 발명하거나 production route를 새 계정에 연결하지 않았다. 실제 staging Worker를 별도 도메인으로 두고 아래 값을 그 환경에 맞게 확인한다.

| 설정 | 확인할 실제 산출물 |
|---|---|
| GITHUB_PAGES_ORIGIN | `/index.html`, `/robots.txt`, `/sitemap.xml`, `/rss.xml`, `/assets/`, `/images/`, `/ai-memo/`, simulator HTML |
| RAW_CONTENT_ORIGIN | `/posts-manifest.json`, `/projects-manifest.json`, `/posts/YYYY/*.md`, 연도별 manifest, project-data |
| SITE_BASE_URL | 공개 페이지의 canonical 도메인. staging에서는 의도된 canonical 목표와 비교 |
| API_BASE_URL | 기존 동적 OG fallback 서비스. 이 검증은 이미지 생성 요청이 아님 |

공개 manifest의 원문과 Pages 빌드 버전이 다르면 동시 배포가 정합한지 먼저 확인한다. A01의 5분 manifest cache에는 반영 지연이 있으므로 배포 직후·만료 후 둘 다 검증한다. 실제 글을 비공개로 바꾸는 경우도 같은 원칙을 적용한다.

## 3. staging 응답 검사

같은 실제 경로를 `User-Agent: Googlebot`, `Bingbot`, 일반 브라우저 UA로 각각 요청한다.

- robots/sitemap/RSS, 실제 JS·CSS·PNG, post/project manifest: Content-Type과 바이트·status 일치. HTML fallback 금지. robots/sitemap/수정 가능한 image의 `immutable` 또는 과도한 TTL 금지.
- 동일 자산 GET/HEAD, If-None-Match, If-Modified-Since, Range/If-Range: 304·206 및 validator 전달 확인. origin이 해당 기능을 지원하는 경우를 사용한다.
- `/projects`: HTML canonical·description·title 각각 하나, canonical이 자기 페이지. CSP·preload·본문과 앱 자산 참조 유지.
- 실제 공개 한글/공백/dotted slug: 정상 metadata. `/post/` 별칭·후행 slash·NFD는 canonical로 연결되고 query 보존. 이중 인코딩이나 경로 구분자 인코딩은 400.
- 실제 없는 글·비공개 글 404. 통제된 staging origin 503은 503, manifest 자체가 없는 상황은 모든 글 404로 숨기지 않음.
- 관리자 로그인·callback·config 화면 자체는 유지, no-store/noindex 확인. 인증 권한은 기존 API 계약으로 검증해야 하며 SEO shell만으로 접근 허용을 판단하지 않음.

자동 canonical 수 확인이나 원문 의미 비교는 실제 HTML 응답을 대상으로 한다. URL Inspection·검색 노출 상승은 이 단계의 성공 조건이 아니다.

## 4. 제한된 배포와 원복

runtime/staging 검증을 통과한 경우에만 실제 배포 권한으로 기존 Worker 배포 경로를 사용한다. 배포 commit/Worker revision, 비교한 Pages/raw content 버전을 기록한다. 기존 1년 캐시였던 robots/sitemap/자산은 서버 정책만 바꿔도 이미 저장된 CDN·브라우저 응답이 즉시 사라지는 것은 아니므로 해당 캐시의 만료/무효화도 확인한다.

5xx·잘못된 canonical·정상 route 차단이 증가하면 검증된 이전 Worker revision 또는 독립 수정 revision으로 되돌린다. 원문·manifest를 지우거나 404를 홈 HTML 200으로 바꾸는 방식으로 오류를 숨기지 않는다. 이전 revision에 crawler 자산 오류가 있었다는 점을 고려해 긴급 복구 후 A01 회귀 테스트를 다시 수행한다.

이 작업에는 DB 삭제/이관이 없으므로 원복 과정에서 기존 메모·대화·이미지 데이터에 손댈 이유가 없다.
