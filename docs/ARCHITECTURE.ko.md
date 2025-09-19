# 통합 아키텍처 개요 (Korean)

이 저장소는 정적 블로그(React + Vite, GitHub Pages 배포)를 그대로 유지하면서, 모든 동적 기능을 단일 Express 백엔드로 통합했습니다. 프런트엔드는 정적 리소스만 제공하고, 댓글/AI/OG 이미지/관리자 기능 등은 별도의 API 도메인으로 라우팅됩니다.

- 정적 사이트(React + Vite): `frontend/` → `frontend/dist/`를 GitHub Pages에 배포
- 통합 백엔드(Express): `backend/` → AI, 댓글, OG 이미지, 관리자 엔드포인트 제공
- 문서 변환기: `doc-converter/` → 순수 클라이언트 앱, Pages의 `/doc-converter/` 경로에 함께 배포
- 레거시 서버리스(`api/`)와 구 `blog-admin/`는 참조용으로만 보관(새 개발 대상 아님)

## 디렉터리

- `backend/` – Node/Express API, 모듈형 라우트, `zod` 기반 설정 검증
  - `src/index.js` – 앱 엔트리: helmet, CORS, rate limit, 로깅; 모든 라우트를 `/api/v1/*`에 마운트
  - `src/config.js` – 타입이 명시된 환경설정, 공개 런타임 설정 엔드포인트 포함
  - `src/routes/ai.js` – AI 엔드포인트: `POST /api/v1/ai/{summarize|generate|sketch|prism|chain}`
  - `src/routes/comments.js` – 댓글: `GET /api/v1/comments?postId=...`, `POST /api/v1/comments`
  - `src/routes/og.js` – OG SVG 생성기: `GET /api/v1/og?...`
  - `src/routes/admin.js` – 관리자: PR 생성, 댓글 보관(아카이브)
  - `src/lib/*` – Gemini, Firebase admin 래퍼
  - `.env.example` – 백엔드 환경변수 예시(CORS/제한 포함)
  - `docker-compose.yml`, `nginx.conf`, `Dockerfile` – 선택적 컨테이너 배포

- `frontend/` – 프런트엔드 앱 + 정적 포스트(`frontend/public/posts/YYYY/*.md`)
  - `frontend/index.html` – 런타임 구성 주입(`APP_CONFIG`)
  - `frontend/config/*` – vite/eslint/tailwind/postcss 설정
  - `frontend/scripts/generate-manifests.js` – 포스트 검증 및 `posts-manifest.json` 생성
  - `frontend/scripts/generate-seo.js` – `sitemap.xml`, `rss.xml`, `robots.txt` 생성/갱신

## 엔드포인트

- Health: `GET /api/v1/healthz`
- 공개 설정: `GET /api/v1/public/config`
- AI
  - `POST /api/v1/ai/summarize` { text|input, instructions? }
  - `POST /api/v1/ai/generate` { prompt, temperature? }
  - `POST /api/v1/ai/{sketch|prism|chain}` { paragraph, postTitle? }
- 댓글
  - `GET /api/v1/comments?postId=...`
  - `POST /api/v1/comments` { postId, author, content, website? }
- OG 이미지: `GET /api/v1/og?title=...&subtitle=...&theme=dark|light&w=1200&h=630`
- 관리자(옵션 Bearer 토큰 보호; `ADMIN_BEARER_TOKEN` 설정 시)
  - `POST /api/v1/admin/propose-new-version` { original?, markdown, sourcePage? }
  - `POST /api/v1/admin/archive-comments?dryRun=1|0`

비고: GitHub 연동은 Octokit v20+ 권장 방식(`octokit.rest.*`)을 따르며, `GIT_USER_NAME`, `GIT_USER_EMAIL` 제공 시 커밋 작성자/커미터 정보를 보존합니다.

## 프런트엔드 연동(백엔드 URL 탐색)

프런트엔드는 `frontend/src/utils/apiBase.ts#getApiBaseUrl()`를 통해 실행 시점에 백엔드 URL을 다음 우선순위로 탐색합니다.

1) `window.APP_CONFIG.apiBaseUrl` – `index.html`에서 런타임 주입
2) `import.meta.env.VITE_API_BASE_URL` – 빌드 타임 환경변수
3) `localStorage['aiMemo.backendUrl']` – 개발 편의용 수동 설정

`frontend/index.html`은 Vite 빌드 시 값을 주입합니다.

```html
<script type="module">
  window.APP_CONFIG = Object.assign({}, window.APP_CONFIG || {}, {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL || null,
  });
</script>
```

`apiBaseUrl`이 유효하면 모든 동적 기능이 `/api/v1/*`로 호출됩니다. 값이 없으면 GitHub Pages 환경과의 호환을 위해 일부 컴포넌트는 정적 JSON 등의 레거시 경로로 폴백합니다.

GitHub Actions 워크플로(`.github/workflows/deploy.yml`)는 리포지토리 시크릿을 통해 `VITE_API_BASE_URL`을 주입하여, 빌드된 정적 사이트가 런타임에 백엔드 URL을 알고 시작하도록 합니다.

## 환경변수

백엔드(`backend/.env.example`):

- `APP_ENV` – development|staging|production
- `HOST`, `PORT` – 기본 `0.0.0.0:5080`
- `ALLOWED_ORIGINS` – CSV; 예) `https://noblog.nodove.com`, 로컬호스트 포함
- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`
- `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GIT_USER_NAME`, `GIT_USER_EMAIL`
- `ADMIN_BEARER_TOKEN` – 설정 시 관리자 엔드포인트에 `Authorization: Bearer <token>` 요구

프런트엔드(빌드 타임):

- `VITE_SITE_BASE_URL` – 사이트 정규 URL
- `VITE_API_BASE_URL` – 통합 백엔드 기준 URL(예: `https://blog-api.nodove.com`)

## 배포

- 로컬 개발
  - 백엔드: `cp backend/.env.example backend/.env && npm --prefix backend install && npm --prefix backend run dev`
  - 프런트엔드: `npm --prefix frontend install && npm --prefix frontend run dev`
- Docker Compose
  - `cd backend && docker compose up -d` → Nginx(`:8091`)가 `/api/*`를 API(`:5080`)로 프록시
- GitHub Pages
  - 정적 사이트만 `dist/`에서 제공하며, API는 제공하지 않습니다(별도 도메인 필요)

## 실시간 통신 여부 및 선택지

현재 저장소에는 WebSocket 또는 SSE(Server‑Sent Events) 기반의 실시간 전송이 없습니다. 모든 상호작용은 일반 HTTP 요청(REST)이며, 프런트엔드는 필요 시 재요청/폴링을 사용할 수 있습니다.

추가하고 싶다면 아래 두 가지 중 하나를 권장합니다.

- SSE(단방향 스트리밍)
  - 장점: 브라우저 기본 `EventSource`, 프록시/로드밸런서 친화적, 헤더만 맞추면 간단
  - 용도: AI 응답 토큰 스트리밍, 댓글 실시간 보강(서버→클라이언트 푸시)
  - 서버 예시(Express)
    ```js
    app.get('/api/v1/ai/generate/stream', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
      // 예시: 토큰 단위로 전송
      generateTokens(req.query.prompt, (token) => send({ token }));
      // 완료 시
      send({ done: true });
      res.end();
    });
    ```
  - 클라이언트 예시
    ```ts
    const es = new EventSource(`${apiBase}/api/v1/ai/generate/stream?prompt=...`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.token) appendToken(data.token);
      if (data.done) es.close();
    };
    ```

- WebSocket(양방향)
  - 장점: 상호작용/협업 기능(예: 라이브 댓글 타이핑 표시, 관리자 실시간 승인 등)
  - 고려: 배포(리버스 프록시, 헬스체크, 오토스케일), 인증(토큰 핸드셰이크), 백프레셔
  - 선택: 기본은 Node `ws` 또는 `socket.io`(네임스페이스, 재연결 편의)

CORS/프록시 주의사항

- GitHub Pages는 API를 호스팅하지 않으므로, 별도의 API 도메인에서 CORS를 정확히 설정해야 합니다.
- SSE/WS는 프록시 타임아웃과 헤더 유지가 중요합니다. Nginx/Cloud 환경에서 `Connection`, `Upgrade`, `Cache-Control` 등을 점검하세요.

## 보안 및 운영

- CORS: `ALLOWED_ORIGINS`에 실제 배포 도메인과 로컬 개발 도메인을 명시
- 속도 제한: `express-rate-limit`으로 과도한 트래픽 방지
- 보안 헤더: `helmet` 적용
- 로깅: `morgan`으로 접근 로그 기록
- 관리자 보호: `ADMIN_BEARER_TOKEN` 설정 시 Bearer 토큰 검증으로 `admin/*` 보호

## 문제 해결 가이드

- API 404가 GitHub Pages에서 발생
  - Pages는 정적 호스팅만 제공합니다. 프런트가 `VITE_API_BASE_URL`로 외부 API 도메인을 바라보도록 설정해야 합니다.
- CORS 오류(403/차단)
  - 백엔드의 `ALLOWED_ORIGINS`에 정적 사이트 도메인(예: `https://noblog.nodove.com`)과 개발 도메인을 추가하세요.
- 백엔드 URL이 비어 있음
  - 배포 파이프라인에서 `VITE_API_BASE_URL`이 누락되었는지 확인하세요. 로컬 개발은 `localStorage['aiMemo.backendUrl']`를 통해 임시 설정 가능합니다.

## 이행(마이그레이션) 메모

- `api/`(서버리스), `blog-admin/`은 더 이상 배선하지 않습니다. 기능은 `backend/`로 이전되었으며, 관리자 플로우는 백엔드의 PR 생성/댓글 보관 엔드포인트로 대체했습니다.

## 향후 작업 제안

- AI 응답 스트리밍(SSE) 도입으로 응답 지연 체감 개선
- 댓글 실시간 보강(WS/SSE) 및 관리자 알림 채널 도입
- `/api/v1/posts` CRUD가 필요하다면 Admin 라우트를 확장하거나 전용 라우트 추가

---

질문이나 개선 요청이 있으면 이 문서에 이슈/PR로 남겨 주세요. 배포 파이프라인과 CORS 설정은 환경별로 상이할 수 있으니 운영 환경에 맞게 값을 조정하세요.
