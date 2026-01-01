# Backend API Server (Blog)

> **⚠️ 아키텍처 마이그레이션 안내**
>
> 현재 시스템은 **Cloudflare Workers 기반**으로 마이그레이션되었습니다.
>
> - **API Gateway**: `workers/api-gateway/` - Cloudflare Tunnel 대신 Workers가 단일 진입점 역할
> - **데이터베이스**: `workers/db-api/` - Cloudflare D1 기반 API
> - **시크릿 관리**: DB 기반 동적 시크릿 관리 (`workers/migrations/0014_secrets_management.sql`)
> - **AI 모델 관리**: DB 기반 설정 (`workers/migrations/0011_ai_model_management.sql`)
>
> 최신 배포 및 설정은 `workers/` 디렉토리와 `.github/workflows/deploy-*.yml` 파일을 참고하세요.
>
> 이 문서는 **로컬 개발 환경** 및 **Docker 기반 레거시 배포**를 위한 참고용으로 유지됩니다.

---

블로그의 API 서버입니다. 게시글 Markdown 관리(CRUD), 통합/연도별 매니페스트 생성, 이미지 업로드/관리, 댓글, AI 기능, OG 이미지 생성 등을 제공합니다.

- 런타임: Node.js 20+
- 프레임워크: Express 4
- 포트: `5080` (기본)
- 주요 경로: `/api/v1/*`

## 빠른 시작 (Quick Start)

로컬 개발 환경 설정:

```bash
# 저장소 클론 후 백엔드 디렉토리로 이동
cd backend

# 환경 변수 설정
cp -n .env.example .env

# 의존성 설치 및 실행
npm ci
npm run dev
```

> **프로덕션 배포**는 아래 "프로덕션 배포" 섹션을 참고하세요.

## 콘텐츠 경로(중요)
코드는 리포지토리 루트를 기준으로 정적 자산 디렉터리를 계산합니다.

- 리포지토리 루트: `repoRoot = path.resolve(process.cwd(), '..')` (기본적으로 `backend/` 한 단계 위)
- 정적 루트: `frontend/public`
- 게시글 디렉터리: `frontend/public/posts`
- 이미지 디렉터리: `frontend/public/images`

도커 컨테이너에서 실행 시 위 경로가 컨테이너 내부에도 존재해야 합니다. 운영·개발 모두에서 변경 사항을 호스트에 보존하려면 컨테이너에 `../frontend/public -> /frontend/public` 바인드 마운트를 권장합니다. 자세한 내용은 아래 Docker 섹션 참고.

## 주요 기능
- **Posts API** (게시글 관리)
  - `GET /api/v1/posts?year=YYYY&includeDrafts=true|false`
  - `GET /api/v1/posts/:year/:slug`
  - `POST /api/v1/posts` (admin)
  - `PUT /api/v1/posts/:year/:slug` (admin)
  - `DELETE /api/v1/posts/:year/:slug` (admin)
  - `POST /api/v1/posts/regenerate-manifests` (admin)
- **Images API** (이미지 관리)
  - `POST /api/v1/images/upload` (admin, multipart form, 필드명 `files`)
  - `GET /api/v1/images?year=YYYY&slug=slug` 또는 `?dir=sub/dir`
  - `DELETE /api/v1/images/:year/:slug/:filename` (admin)
- **Comments API** (댓글)
  - `GET /api/v1/comments?postId=...`
  - `POST /api/v1/comments` {postId, author, content, website?}
- **AI API** (AI 기능)
  - `POST /api/v1/ai/summarize` {text|input, instructions?}
  - `POST /api/v1/ai/generate` {prompt, temperature?}
  - `POST /api/v1/ai/{sketch|prism|chain}` {paragraph, postTitle?}
- **OG Image** (Open Graph 이미지 생성)
  - `GET /api/v1/og?title=...&subtitle=...&theme=dark|light`
- **Admin API** (관리자 기능)
  - `POST /api/v1/admin/propose-new-version` (GitHub PR 생성)
  - `POST /api/v1/admin/archive-comments` (댓글 아카이빙)
- **공용**
  - `GET /api/v1/healthz` (헬스체크)
  - `GET /api/v1/public/config` (프론트에서 필요한 공개설정)

## 환경 변수

프로덕션용 설정 템플릿: `backend/.env.production.example`

- 기본: `.env.production.example`을 `.env`로 복사·수정 (`cp backend/.env.production.example backend/.env`)
- 선택: 로컬 전용 오버라이드가 필요하면 `backend/.env`를 추가로 둘 수 있습니다.

- 서버/네트워킹
  - `APP_ENV` (`development|staging|production`) 기본 `development`
  - `HOST` 기본 `0.0.0.0`
  - `PORT` 기본 `5080`
  - `TRUST_PROXY` 프록시 홉 수. 기본 `1`
  - `ALLOWED_ORIGINS` CORS 허용 원본(콤마 구분)
  - `API_BASE_URL`, `SITE_BASE_URL`
  - 레이트 리밋: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`
- 인증
  - `ADMIN_BEARER_TOKEN` 관리자 보호 라우트 토큰. 미설정 시 로컬 개발 편의를 위해 보호가 비활성화됩니다(운영에서는 반드시 설정!).
  - (선택) `JWT_SECRET`, `JWT_EXPIRES_IN`을 설정하면 `/api/v1/auth/login` 에서 JWT 발급 후 동일 토큰을 Admin 라우트 보호에 사용할 수 있습니다. 중앙 미들웨어: `src/middleware/adminAuth.js`
- 통합(옵션)
  - Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`
  - Firebase: `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`
  - GitHub(PR 생성용): `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GIT_USER_NAME`, `GIT_USER_EMAIL`

## 로컬(네이티브) 실행
사전 준비: Node.js 20+, npm 10+, `frontend/public` 존재(없으면 자동 생성되지만, 리포지토리 구조를 유지하는 것이 좋습니다)

```bash
cd backend
cp -n .env.example .env
# 필요 시 ADMIN_BEARER_TOKEN 설정
npm ci
npm run dev
# http://localhost:5080/api/v1/healthz 확인
```

## Docker로 실행
### 1) docker compose (리버스 프록시 포함)
`backend/docker-compose.yml`은 API와 nginx를 올립니다.

```bash
cd backend
cp -n .env.example .env
# 호스트의 정적 자산(프론트 빌드 소스)을 컨테이너에 마운트해 변경사항을 보존
# docker-compose.override.yml 생성(권장):
cat > docker-compose.override.yml <<'YAML'
services:
  api:
    volumes:
      - ../frontend/public:/frontend/public
  nginx:
    ports:
      - "8091:80"
YAML

docker compose up --build
# nginx 프록시 경유:    http://localhost:8091/api/v1/healthz
# 백엔드에 직결(포트): http://localhost:5080/api/v1/healthz
```

주의: 기본 `nginx.conf`는 `client_max_body_size 2m`입니다. 이미지 업로드 시 413이 난다면 `25m` 등으로 늘리세요.

```nginx
# backend/nginx.conf
server {
  client_max_body_size 25m; # 필요 시 조정
  ...
}
```

### 2) 단일 docker run (에페메럴/테스트)
`frontend/public` 대신 임시 디렉터리를 마운트하여 안전하게 실험할 수 있습니다.

```bash
TMP=$(mktemp -d)
# 임시 디렉터리에 posts/images가 생성됩니다
docker run --rm -it \
  -p 5080:5080 \
  --env-file backend/.env \
  -v "$TMP:/frontend/public" \
  -w /app \
  node:20-alpine sh -lc '
    apk add --no-cache nodejs npm && \
    cd /app && \
    mkdir -p /app && \
    # 애플리케이션 이미지 사용을 권장. 예시는 이해를 위한 baseline.
    exit 0
  '
# 권장: 프로젝트 이미지로 빌드/실행
# docker build -t blog-backend:local backend
# docker run --rm -p 5080:5080 --env-file backend/.env -v "$TMP:/frontend/public" blog-backend:local
```

## 매니페스트 생성/정합성
- 게시글 작성/수정/삭제 시:
  - 연도별 `frontend/public/posts/<year>/manifest.json` 갱신
  - 통합 `frontend/public/posts-manifest.json` 및 `frontend/public/posts/posts-manifest.json` 갱신
- 프론트의 `scripts/generate-manifests.js`와 구조 호환(필드: `title`, `slug`, `date`, `tags`, `readingTime`, `coverImage`, ...)

## 엔드포인트 요약
- Health: `GET /api/v1/healthz`
- Public config: `GET /api/v1/public/config`
- Posts
  - List: `GET /api/v1/posts?year=&includeDrafts=`
  - Get: `GET /api/v1/posts/:year/:slug`
  - Create: `POST /api/v1/posts` (admin)
  - Update: `PUT /api/v1/posts/:year/:slug` (admin)
  - Delete: `DELETE /api/v1/posts/:year/:slug` (admin)
  - Regenerate manifests: `POST /api/v1/posts/regenerate-manifests` (admin)
- Images
  - Upload: `POST /api/v1/images/upload` (admin, multipart: `files=@...` 여러개 허용)
  - List: `GET /api/v1/images?year=YYYY&slug=slug` 또는 `GET /api/v1/images?dir=covers`
  - Delete: `DELETE /api/v1/images/:year/:slug/:filename` (admin)

## 보안 & 운영 팁
- Admin 보호 구조: `src/middleware/adminAuth.js`가 모든 (posts/images/admin 등) 쓰기/민감 라우트에서 재사용됩니다. 이전 개별 파일 내 inline 검사 로직은 제거되었습니다.
- JWT 유틸: `src/lib/jwt.js`에 `signJwt`, `verifyJwt`, `isAdminClaims` 제공. Auth 라우트(`/api/v1/auth/*`)는 이를 사용하여 일관성 유지.
- 운영 환경에서는 반드시 `ADMIN_BEARER_TOKEN`을 설정하여 쓰기 라우트를 보호하세요.
- CORS는 `ALLOWED_ORIGINS`에서 엄격히 제한하세요.
- 리버스 프록시(Nginx/Cloud) 앞에서는 `TRUST_PROXY`를 올바르게 설정하세요.
- 업로드 용량 제한은 프록시(Nginx)와 Express 양쪽에서 고려하세요.
- Docker로 실행 시 볼륨 마운트로 `frontend/public`을 호스트에 보존하는 구성을 권장합니다.

## 프로덕션 배포

> **참고**: 프로덕션 환경에서는 Cloudflare Workers 기반 배포를 권장합니다.
> `workers/api-gateway/README.md`를 참고하세요.

### 옵션 1: Cloudflare Workers (권장)
```bash
cd workers/api-gateway
npm install
npx wrangler deploy --env production
```
자세한 내용은 `workers/api-gateway/README.md` 참고.

### 옵션 2: PM2 + Docker (레거시)
```bash
cd backend
bash scripts/setup.sh --pm2
```

### 옵션 3: systemd + Nginx (레거시)
```bash
cd backend
bash scripts/setup.sh --systemd --nginx
```

### 수동 설정 (레거시)
- PM2 설정: `ecosystem.config.js`
- systemd 서비스: `deploy/blog-backend.service`
- Nginx 설정: `deploy/nginx-blog-api.conf`

## GitHub Actions 연동

1. 리포지토리 Settings → Secrets → Actions
2. `VITE_API_BASE_URL` Secret 추가
3. 값: 백엔드의 공개 HTTPS URL (예: `https://api.yourdomain.com`)
4. main 브랜치 푸시 시 자동으로 프론트엔드가 빌드/배포되며 API URL이 주입됨

## 트러블슈팅
- 401 Unauthorized: `Authorization: Bearer <token>` 헤더 확인, 토큰 값 일치 여부 확인
- 413 Payload Too Large: Nginx `client_max_body_size` 증가, Express `express.json({ limit })` 조정 검토
- CORS 오류: `ALLOWED_ORIGINS`에 호출 원본 추가
- 매니페스트가 갱신되지 않음: 쓰기 연산 후 에러 로그 확인, 파일 권한/볼륨 마운트 경로 확인
- Mixed Content: `VITE_API_BASE_URL`이 HTTPS로 설정되었는지 확인
- PR 생성 실패: GitHub 토큰 권한, 리포지토리 설정 확인

## 관련 문서
- [Frontend-Backend 연동 PRD](../docs/PRD-fe-be-integration.md) - 상세한 설치 및 연동 가이드
- [아키텍처 문서](../docs/ARCHITECTURE.md) - 전체 시스템 구조
